import XCTest

final class TavixoUITests: XCTestCase {
    @MainActor func testDemoNavigationWithoutRealAccount() {
        let app=XCUIApplication(); app.launchArguments=["-tavixo-demo"]; app.launch()
        XCTAssertTrue(app.staticTexts["DEMO LOCAL · datos ficticios"].waitForExistence(timeout:15))
        let overview=XCTAttachment(screenshot:app.screenshot()); overview.name="Inicio demo"; overview.lifetime = .keepAlways; add(overview)
        app.buttons["Mesas"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Mesa 1"].waitForExistence(timeout:5))
        app.buttons["Comandas"].firstMatch.tap()
        let order=app.staticTexts["#12 · Mesa 1"].firstMatch
        XCTAssertTrue(order.waitForExistence(timeout:5)); order.tap()
        XCTAssertTrue(app.navigationBars["Comanda #12"].waitForExistence(timeout:5))
        let detail=XCTAttachment(screenshot:app.screenshot()); detail.name="Comanda demo"; detail.lifetime = .keepAlways; add(detail)
        app.buttons["Cuenta"].firstMatch.tap()
        let logout=app.buttons["logout-button"]
        if !logout.isHittable { app.swipeUp() }
        XCTAssertTrue(logout.waitForExistence(timeout:5)); logout.tap()
        XCTAssertTrue(app.textFields["restaurant-field"].waitForExistence(timeout:5))
        XCTAssertEqual(app.textFields["restaurant-field"].value as? String,"Ej. mi-restaurante")
        let login=XCTAttachment(screenshot:app.screenshot()); login.name="Acceso"; login.lifetime = .keepAlways; add(login)
    }
}
