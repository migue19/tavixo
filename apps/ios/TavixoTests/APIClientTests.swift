import XCTest
import UIKit
@testable import Tavixo

private final class MemorySecrets: SecretStore {
    var value: String?
    var failWrite = false
    var failClear = false
    init(_ value: String? = nil) { self.value = value }
    func read() throws -> String? { value }
    func write(_ value: String) throws { if failWrite { throw APIError.storage }; self.value = value }
    func clear() throws { if failClear { throw APIError.storage }; value = nil }
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
        let store=AppStore(api:client(secrets),pendingSecrets:MemorySecrets())
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
    private let testBranch = "00000000-0000-4000-8000-000000000002"
    private let testTable = "00000000-0000-4000-8000-000000000003"
    private let testProduct = "00000000-0000-4000-8000-000000000004"
    private let testOrder = "00000000-0000-4000-8000-000000000005"
    private var orderResponse: Data {
        Data("""
        {"id":"\(testOrder)","number":42,"tableId":"\(testTable)","tableName":"Mesa de prueba","status":"SENT","totalCents":12300,"notes":"","createdByName":"Example","createdAt":"2026-11-03T15:00:00Z","items":[]}
        """.utf8)
    }
    private func requestData(_ request: URLRequest) -> Data {
        if let data = request.httpBody { return data }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open(); defer { stream.close() }
        var result = Data(), buffer = [UInt8](repeating:0,count:4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer,maxLength:buffer.count)
            if read <= 0 { break }; result.append(contentsOf:buffer.prefix(read))
        }
        return result
    }
    @MainActor private func orderStore(pending: MemorySecrets = MemorySecrets(), role: String = "OWNER") async -> (AppStore, APIClient) {
        let api = client(MemorySecrets())
        let login = Data(String(decoding:payload(),as:UTF8.self).replacingOccurrences(of:"OWNER",with:role).utf8), headers = cookie
        let branches = Data("[{\"id\":\"\(testBranch)\",\"name\":\"Example\",\"active\":true}]".utf8)
        StubProtocol.handler = { request in
            request.url!.path.hasSuffix("branches") ? (200,[:],branches) : (201,headers,login)
        }
        let store = AppStore(api:api,pendingSecrets:pending)
        await store.login(restaurant:"example",email:"demo@example.test",password:"test")
        await store.loadBranches()
        return (store,api)
    }
    @MainActor func testOrderWriteSendsOnlyIDsQuantitiesNotesAndServerExpectedTotal() async throws {
        let (store,_) = await orderStore(), result = orderResponse
        let target = OrderTarget(tableID:testTable,tableName:"Mesa de prueba",orderID:nil,expectedTotalCents:nil)
        let product = testProduct
        StubProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod,"POST")
            XCTAssertEqual(request.url?.path,"/api/restaurant/branches/\(self.testBranch)/orders")
            XCTAssertEqual(request.value(forHTTPHeaderField:"Authorization"),"Bearer access-test")
            XCTAssertNil(request.value(forHTTPHeaderField:"Cookie"))
            let body = try JSONSerialization.jsonObject(with:self.requestData(request)) as! [String:Any]
            XCTAssertNotNil(UUID(uuidString:body["requestId"] as! String))
            XCTAssertEqual(Set(body.keys),["requestId","tableId","notes","items"])
            let line = (body["items"] as! [[String:Any]])[0]
            XCTAssertEqual(Set(line.keys),["productId","quantity","notes"])
            XCTAssertEqual(line["productId"] as? String,product)
            return (201,[:],result)
        }
        let order = try await store.sendOrder(target:target,items:[OrderLineInput(productId:testProduct,quantity:2,notes:"Sin cebolla")],notes:"Prueba",branchID:testBranch,context:store.session!.context)
        XCTAssertEqual(order.totalCents,12300); XCTAssertNil(store.pendingOrder)
        XCTAssertEqual(store.orders.first?.id,testOrder)
    }
    @MainActor func testUncertainWriteIsPersistedAndExactRetrySurvivesRestart() async throws {
        let pending = MemorySecrets(), (store,_) = await orderStore(pending:pending)
        let target = OrderTarget(tableID:testTable,tableName:"Mesa",orderID:testOrder,expectedTotalCents:5000)
        StubProtocol.handler = { _ in throw URLError(.networkConnectionLost) }
        do { _ = try await store.sendOrder(target:target,items:[OrderLineInput(productId:testProduct,quantity:1,notes:"Nota")],notes:"Ronda",branchID:testBranch,context:store.session!.context); XCTFail("Expected lost response") } catch APIError.network {}
        let raw = try XCTUnwrap(pending.value), original = try JSONDecoder().decode(PendingOrder.self,from:Data(raw.utf8))
        XCTAssertEqual(original.body.expectedTotalCents,5000); XCTAssertNil(original.body.tableId)
        let (restored,_) = await orderStore(pending:pending), result = orderResponse
        XCTAssertEqual(restored.pendingOrder?.body.requestId,original.body.requestId)
        StubProtocol.handler = { request in
            let body = try JSONDecoder().decode(OrderWriteBody.self,from:self.requestData(request))
            XCTAssertEqual(body,original.body)
            XCTAssertTrue(request.url!.path.hasSuffix("/\(self.testOrder)/rounds"))
            return (201,[:],result)
        }
        _ = try await restored.sendOrder(target:target,items:[OrderLineInput(productId:testProduct,quantity:99,notes:"Changed UI")],notes:"Changed",branchID:testBranch,context:restored.session!.context)
        XCTAssertNil(pending.value); XCTAssertNil(restored.pendingOrder)
    }
    @MainActor func testKeychainWriteFailurePreventsNetworkMutation() async throws {
        let pending = MemorySecrets(), (store,_) = await orderStore(pending:pending)
        pending.failWrite = true
        StubProtocol.handler = { _ in XCTFail("Must not send without persisted UUID"); return (500,[:],Data()) }
        do { _ = try await store.sendOrder(target:OrderTarget(tableID:testTable,tableName:"Mesa",orderID:nil,expectedTotalCents:nil),items:[OrderLineInput(productId:testProduct,quantity:1,notes:"")],notes:"",branchID:testBranch,context:store.session!.context); XCTFail("Expected storage failure") } catch APIError.storage {}
        XCTAssertNil(store.pendingOrder)
    }
    @MainActor func testConflictRequiresReviewAndNextSubmissionUsesNewUUID() async throws {
        let pending = MemorySecrets(), (store,_) = await orderStore(pending:pending)
        let target = OrderTarget(tableID:testTable,tableName:"Mesa",orderID:testOrder,expectedTotalCents:1000)
        nonisolated(unsafe) var firstID: String?
        StubProtocol.handler = { request in
            firstID = try JSONDecoder().decode(OrderWriteBody.self,from:self.requestData(request)).requestId
            return (409,[:],Data())
        }
        do { _ = try await store.sendOrder(target:target,items:[OrderLineInput(productId:testProduct,quantity:1,notes:"")],notes:"",branchID:testBranch,context:store.session!.context); XCTFail("Expected conflict") } catch APIError.conflict {}
        XCTAssertNil(store.pendingOrder); XCTAssertNil(pending.value)
        let result = orderResponse
        StubProtocol.handler = { request in
            XCTAssertNotEqual(try JSONDecoder().decode(OrderWriteBody.self,from:self.requestData(request)).requestId,firstID)
            return (201,[:],result)
        }
        _ = try await store.sendOrder(target:target,items:[OrderLineInput(productId:testProduct,quantity:1,notes:"")],notes:"",branchID:testBranch,context:store.session!.context)
    }
    @MainActor func testPendingFromOtherIdentityIsHiddenAndBlocksNewOrders() async throws {
        let body = OrderWriteBody(requestId:UUID().uuidString,tableId:testTable,expectedTotalCents:nil,notes:"",items:[])
        let other = PendingOrder(restaurantID:"other-tenant",userID:"other-user",branchID:testBranch,tableID:testTable,tableName:"Private",orderID:nil,body:body)
        let pending = MemorySecrets(String(decoding:try JSONEncoder().encode(other),as:UTF8.self))
        let (store,_) = await orderStore(pending:pending)
        XCTAssertNil(store.pendingOrder); XCTAssertTrue(store.hasForeignPendingOrder); XCTAssertFalse(store.canStartOrder)
        XCTAssertNotNil(pending.value)
    }
    @MainActor func testMutationDoesNotAutoReplay401AndKeepsPendingForSameIdentity() async throws {
        let pending = MemorySecrets(), (store,_) = await orderStore(pending:pending), context = store.session!.context
        nonisolated(unsafe) var calls = 0
        StubProtocol.handler = { _ in calls += 1; return (401,[:],Data()) }
        do { _ = try await store.sendOrder(target:OrderTarget(tableID:testTable,tableName:"Mesa",orderID:nil,expectedTotalCents:nil),items:[OrderLineInput(productId:testProduct,quantity:1,notes:"")],notes:"",branchID:testBranch,context:context); XCTFail("Expected auth failure") } catch APIError.unauthorized {}
        XCTAssertEqual(calls,1); XCTAssertNil(store.session); XCTAssertNotNil(pending.value)
    }
    @MainActor func testPendingRetryDeniedLaterDoesNotDiscardUncertainOriginal() async throws {
        let pending = MemorySecrets(), (store,_) = await orderStore(pending:pending)
        let target = OrderTarget(tableID:testTable,tableName:"Mesa",orderID:nil,expectedTotalCents:nil)
        let items = [OrderLineInput(productId:testProduct,quantity:1,notes:"")]
        StubProtocol.handler = { _ in (500,[:],Data()) }
        do { _ = try await store.sendOrder(target:target,items:items,notes:"",branchID:testBranch,context:store.session!.context); XCTFail("Expected failure") } catch APIError.server {}
        let raw = pending.value
        StubProtocol.handler = { _ in (403,[:],Data()) }
        do { _ = try await store.sendOrder(target:target,items:items,notes:"",branchID:testBranch,context:store.session!.context); XCTFail("Expected denial") } catch APIError.forbidden {}
        XCTAssertEqual(pending.value,raw); XCTAssertNotNil(store.pendingOrder)
    }
    @MainActor func testMutationRefusesChangedIdentityBeforeSending() async throws {
        let (_,api) = await orderStore()
        StubProtocol.handler = { _ in XCTFail("Changed identity cannot send"); return (201,[:],Data()) }
        do { let _: RestaurantOrder = try await api.post("restaurant/branches/\(testBranch)/orders",body:["requestId":"test"],context:"other-context",as:RestaurantOrder.self); XCTFail("Expected rejection") } catch APIError.contextChanged {}
    }
    func testMenuAvailabilityAndOrderBounds() {
        let category = MenuCategory(id:"active",name:"Example",active:true)
        let products = [
            MenuProduct(id:"ok",categoryId:"active",name:"A",description:"",priceCents:100,active:true,available:true),
            MenuProduct(id:"inactive",categoryId:"active",name:"B",description:"",priceCents:100,active:false,available:true),
            MenuProduct(id:"sold-out",categoryId:"active",name:"C",description:"",priceCents:100,active:true,available:false),
            MenuProduct(id:"hidden-category",categoryId:"inactive",name:"D",description:"",priceCents:100,active:true,available:true)]
        XCTAssertEqual(availableProducts(products,categories:[category]).map(\.id),["ok"])
        let line = OrderLineInput(productId:testProduct,quantity:100,notes:String(repeating:"a",count:300))
        XCTAssertTrue(validOrderLines([line],notes:String(repeating:"a",count:500)))
        XCTAssertFalse(validOrderLines([line,line],notes:""))
        XCTAssertFalse(validOrderLines([OrderLineInput(productId:testProduct,quantity:101,notes:"")],notes:""))
        XCTAssertFalse(validOrderLines([line],notes:String(repeating:"a",count:501)))
        XCTAssertFalse(validOrderLines([],notes:""))
    }

    @MainActor func testConcurrentSubmitCannotCreateSecondWrite() async throws {
        let (store,_) = await orderStore(), result = orderResponse
        let target = OrderTarget(tableID:testTable,tableName:"Mesa",orderID:nil,expectedTotalCents:nil)
        let items = [OrderLineInput(productId:testProduct,quantity:1,notes:"")], context = store.session!.context
        let gate = DispatchSemaphore(value:0)
        nonisolated(unsafe) var calls = 0
        StubProtocol.handler = { _ in calls += 1; _ = gate.wait(timeout:.now()+5); return (201,[:],result) }
        let first = Task { try await store.sendOrder(target:target,items:items,notes:"",branchID:testBranch,context:context) }
        while !store.sendingOrder { await Task.yield() }
        do { _ = try await store.sendOrder(target:target,items:items,notes:"",branchID:testBranch,context:context); XCTFail("Expected busy rejection") } catch APIError.contextChanged {}
        gate.signal(); _ = try await first.value
        XCTAssertEqual(calls,1); XCTAssertNil(store.pendingOrder)
    }
    @MainActor func testFailedPendingDeletionPreservesUUIDAfterSuccessfulServerResponse() async throws {
        let pending = MemorySecrets(), (store,_) = await orderStore(pending:pending), result = orderResponse
        let target = OrderTarget(tableID:testTable,tableName:"Mesa",orderID:nil,expectedTotalCents:nil)
        let items = [OrderLineInput(productId:testProduct,quantity:1,notes:"")]
        pending.failClear = true
        StubProtocol.handler = { _ in (201,[:],result) }
        do { _ = try await store.sendOrder(target:target,items:items,notes:"",branchID:testBranch,context:store.session!.context); XCTFail("Expected keychain failure") } catch APIError.storage {}
        XCTAssertNotNil(store.pendingOrder); XCTAssertNotNil(pending.value)
        let expected = store.pendingOrder!.body
        pending.failClear = false
        StubProtocol.handler = { request in
            XCTAssertEqual(try JSONDecoder().decode(OrderWriteBody.self,from:self.requestData(request)),expected)
            return (201,[:],result)
        }
        _ = try await store.sendOrder(target:target,items:items,notes:"",branchID:testBranch,context:store.session!.context)
        XCTAssertNil(pending.value)
    }
    @MainActor func testKitchenCannotSubmitOrderEvenThroughStore() async throws {
        let (store,_) = await orderStore(role:"KITCHEN")
        XCTAssertFalse(store.canTakeOrders); XCTAssertFalse(store.canStartOrder)
        StubProtocol.handler = { _ in XCTFail("Kitchen must not send writes"); return (201,[:],Data()) }
        do { _ = try await store.sendOrder(target:OrderTarget(tableID:testTable,tableName:"Mesa",orderID:nil,expectedTotalCents:nil),items:[OrderLineInput(productId:testProduct,quantity:1,notes:"")],notes:"",branchID:testBranch,context:store.session!.context); XCTFail("Expected denial") } catch APIError.contextChanged {}
    }

}
