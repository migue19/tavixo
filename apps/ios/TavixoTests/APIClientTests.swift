import XCTest
import UIKit
@testable import Tavixo

private final class MemorySecrets: SecretStore {
    var value: String?
    var failWrite = false
    init(_ value: String? = nil) { self.value = value }
    func read() throws -> String? { value }
    func write(_ value: String) throws { if failWrite { throw APIError.storage }; self.value = value }
    func clear() throws { value = nil }
}
private final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Int,[String:String],Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status,headers,data) = try Self.handler!(request)
            let response = HTTPURLResponse(url:request.url!,statusCode:status,httpVersion:"HTTP/1.1",headerFields:headers)!
            client?.urlProtocol(self,didReceive:response,cacheStoragePolicy:.notAllowed)
            client?.urlProtocol(self,didLoad:data); client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self,didFailWithError:error) }
    }
    override func stopLoading() {}
}
final class APIClientTests: XCTestCase {
    private func payload(_ token: String = "access-test") -> Data {
        Data("""
        {"accessToken":"\(token)","expiresIn":900,"user":{"id":"user-a","name":"Demo","email":"demo@example.test","role":"OWNER","branchId":null},"restaurant":{"id":"tenant-a","name":"Example","slug":"example","branding":null}}
        """.utf8)
    }
    private var cookie: [String:String] { ["Set-Cookie":"tavixo_refresh=rotated-secret; Path=/api/auth; HttpOnly; Secure; SameSite=Strict"] }
    @MainActor private func client(_ secrets: MemorySecrets) -> APIClient {
        let c=URLSessionConfiguration.ephemeral; c.protocolClasses=[StubProtocol.self]; c.httpCookieStorage=nil; c.urlCache=nil
        return APIClient(baseURL:URL(string:"https://example.test")!,secrets:secrets,configuration:c)
    }
    @MainActor func testLoginKeepsOnlyRefreshCookieAndSendsExpectedOrigin() async throws {
        let secrets=MemorySecrets(), body=payload(), headers=cookie
        StubProtocol.handler={ request in
            XCTAssertEqual(request.value(forHTTPHeaderField:"Origin"),"https://example.test")
            XCTAssertNil(request.value(forHTTPHeaderField:"Cookie"))
            XCTAssertEqual(request.httpMethod,"POST")
            return (201,headers,body)
        }
        let api=client(secrets); let result=try await api.login(restaurant:"example",email:"demo@example.test",password:"not-a-real-password")
        XCTAssertEqual(result.restaurant.id,"tenant-a"); XCTAssertEqual(secrets.value,"rotated-secret")
        XCTAssertFalse(secrets.value!.contains("access-test"))
    }
    @MainActor func testConcurrentRefreshUsesSingleRotation() async throws {
        let secrets=MemorySecrets("old-secret"), body=payload(), headers=cookie
        let lock=NSLock(); nonisolated(unsafe) var calls=0
        StubProtocol.handler={ request in
            lock.lock(); calls += 1; lock.unlock()
            XCTAssertEqual(request.value(forHTTPHeaderField:"Cookie"),"tavixo_refresh=old-secret")
            return (201,headers,body)
        }
        let api=client(secrets)
        async let a=api.renew(); async let b=api.renew()
        _ = try await (a,b)
        XCTAssertEqual(calls,1); XCTAssertEqual(secrets.value,"rotated-secret")
    }
    @MainActor func testExpiredCredentialClearsLocalIdentity() async throws {
        let secrets=MemorySecrets("revoked")
        StubProtocol.handler={ _ in (401,[:],Data()) }
        let api=client(secrets)
        do { _ = try await api.renew(); XCTFail("Expected rejection") } catch APIError.unauthorized {} catch { XCTFail("Unexpected error") }
        XCTAssertNil(secrets.value); XCTAssertNil(api.session)
    }
    @MainActor func testNetworkFailurePreservesCredentialForExplicitRetry() async throws {
        let secrets=MemorySecrets("saved")
        StubProtocol.handler={ _ in throw URLError(.notConnectedToInternet) }
        do { _ = try await client(secrets).renew(); XCTFail("Expected failure") } catch APIError.network {} catch { XCTFail("Unexpected error") }
        XCTAssertEqual(secrets.value,"saved")
    }
    @MainActor func testGetRetriesWithRotatedTokenAndRejectsFurther401() async throws {
        let secrets=MemorySecrets(), headers=cookie, first=payload("old-access"), second=payload("new-access")
        let lock=NSLock(); nonisolated(unsafe) var gets=0
        StubProtocol.handler={ request in
            if request.url!.path.hasSuffix("login") { return (201,headers,first) }
            if request.url!.path.hasSuffix("refresh") { return (201,headers,second) }
            lock.lock(); gets += 1; let count=gets; lock.unlock()
            XCTAssertEqual(request.value(forHTTPHeaderField:"Authorization"),count == 1 ? "Bearer old-access" : "Bearer new-access")
            return (401,[:],Data())
        }
        let api=client(secrets); _ = try await api.login(restaurant:"example",email:"demo@example.test",password:"test")
        do { let _: [Branch] = try await api.get("restaurant/branches",as:[Branch].self); XCTFail("Expected failure") } catch APIError.unauthorized {} catch { XCTFail("Unexpected error") }
        XCTAssertEqual(gets,2); XCTAssertNil(api.session); XCTAssertNil(secrets.value)
    }
    @MainActor func testForbiddenDoesNotReplayOrLoseSession() async throws {
        let secrets=MemorySecrets(), headers=cookie, body=payload()
        StubProtocol.handler={ request in request.url!.path.hasSuffix("login") ? (201,headers,body) : (403,[:],Data()) }
        let api=client(secrets); _ = try await api.login(restaurant:"example",email:"demo@example.test",password:"test")
        do { let _: [Branch] = try await api.get("restaurant/branches",as:[Branch].self); XCTFail("Expected denial") } catch APIError.forbidden {} catch { XCTFail("Unexpected error") }
        XCTAssertNotNil(api.session); XCTAssertEqual(secrets.value,"rotated-secret")
    }
    @MainActor func testFailedLogoutRetainsCredentialAndSuccessfulLogoutClearsIt() async throws {
        let secrets=MemorySecrets("current")
        StubProtocol.handler={ _ in throw URLError(.notConnectedToInternet) }
        let api=client(secrets)
        do { try await api.logout(); XCTFail("Expected failure") } catch {}
        XCTAssertEqual(secrets.value,"current")
        StubProtocol.handler={ request in
            XCTAssertEqual(request.value(forHTTPHeaderField:"Cookie"),"tavixo_refresh=current")
            return (201,[:],Data("{\"ok\":true}".utf8))
        }
        try await api.logout(); XCTAssertNil(secrets.value)
    }
    @MainActor func testHTTPOriginIsRejectedBeforeSendingCredentials() async throws {
        let api=APIClient(baseURL:URL(string:"http://example.test")!,secrets:MemorySecrets())
        do { _ = try await api.login(restaurant:"example",email:"demo@example.test",password:"test"); XCTFail("Expected denial") } catch APIError.insecureURL {} catch { XCTFail("Unexpected error") }
    }
    @MainActor func testKeychainFailureDoesNotLeaveAuthenticatedState() async throws {
        let secrets=MemorySecrets(); secrets.failWrite=true
        let body=payload(),headers=cookie
        StubProtocol.handler={ request in request.url!.path.hasSuffix("logout") ? (201,[:],Data()) : (201,headers,body) }
        let api=client(secrets)
        do { _ = try await api.login(restaurant:"example",email:"demo@example.test",password:"test"); XCTFail("Expected failure") } catch APIError.storage {} catch { XCTFail("Unexpected error") }
        XCTAssertNil(api.session); XCTAssertNil(secrets.value)
    }
    @MainActor func testMalformedRotationRevokesNewCookieAndClearsOldCredential() async throws {
        let secrets=MemorySecrets("old-secret"), headers=cookie
        let lock=NSLock(); nonisolated(unsafe) var revoked=false
        StubProtocol.handler={ request in
            if request.url!.path.hasSuffix("logout") {
                XCTAssertEqual(request.value(forHTTPHeaderField:"Cookie"),"tavixo_refresh=rotated-secret")
                lock.lock(); revoked=true; lock.unlock()
                return (201,[:],Data())
            }
            return (201,headers,Data("not-json".utf8))
        }
        let api=client(secrets)
        do { _ = try await api.renew(); XCTFail("Expected failure") } catch APIError.invalidResponse {} catch { XCTFail("Unexpected error") }
        XCTAssertTrue(revoked); XCTAssertNil(api.session); XCTAssertNil(secrets.value)
    }
    @MainActor func testInvalidLoginDoesNotPersistCredentials() async throws {
        for status in [400,401] {
            let secrets=MemorySecrets()
            StubProtocol.handler={ _ in (status,[:],Data()) }
            let api=client(secrets)
            do { _ = try await api.login(restaurant:"bad",email:"demo@example.test",password:"test"); XCTFail("Expected failure") } catch APIError.credentials {} catch { XCTFail("Unexpected error") }
            XCTAssertNil(secrets.value); XCTAssertNil(api.session)
        }
    }
    @MainActor func testDemoCannotReplaceLoginWhileAuthenticationIsInFlight() async throws {
        let secrets=MemorySecrets(),body=payload(),headers=cookie
        let gate=DispatchSemaphore(value:0)
        StubProtocol.handler={ _ in _ = gate.wait(timeout:.now()+5); return (201,headers,body) }
        let store=AppStore(api:client(secrets))
        let task=Task { await store.login(restaurant:"example",email:"demo@example.test",password:"test") }
        while !store.authBusy { await Task.yield() }
        store.startDemo(); XCTAssertFalse(store.isDemo)
        gate.signal(); await task.value
        XCTAssertFalse(store.isDemo); XCTAssertEqual(store.session?.restaurant.id,"tenant-a")
    }
    func testBranchScopeAndNetQuantities() {
        let a=Branch(id:"a",name:"A",address:nil,active:true),b=Branch(id:"b",name:"B",address:nil,active:true),inactive=Branch(id:"c",name:"C",address:nil,active:false)
        XCTAssertEqual(permittedBranches([a,b,inactive],user:StaffUser(id:"u",name:"User",email:"demo@example.test",role:.waiter,branchId:"b")).map(\.id),["b"])
        XCTAssertEqual(permittedBranches([a,b,inactive],user:StaffUser(id:"u",name:"User",email:"demo@example.test",role:.kitchen,branchId:nil)).count,0)
        XCTAssertEqual(permittedBranches([a,b,inactive],user:StaffUser(id:"u",name:"User",email:"demo@example.test",role:.owner,branchId:nil)).count,2)
        XCTAssertEqual(OrderItem(id:"i",name:"Test",quantity:3,cancelledQuantity:1,unitPriceCents:12345,notes:nil).remaining,2)
        XCTAssertTrue(money(12345).contains("123.45"))
    }
    func testKeychainRoundTripInIsolatedNamespace() throws {
        let store=KeychainStore(service:"mx.com.nut.tavixo.tests." + UUID().uuidString)
        defer { try? store.clear() }
        XCTAssertNil(try store.read())
        try store.write("local-test-refresh")
        XCTAssertEqual(try store.read(),"local-test-refresh")
        try store.write("rotated-test-refresh")
        XCTAssertEqual(try store.read(),"rotated-test-refresh")
        try store.clear(); XCTAssertNil(try store.read())
    }
    @MainActor func testBrandTypefaceIsRegistered() { XCTAssertNotNil(UIFont(name:"Manrope-ExtraLight",size:18)) }
}
