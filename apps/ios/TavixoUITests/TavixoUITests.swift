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
    @MainActor func testCreateOrderAndSecondRoundInFictitiousDemo() {
        let app=XCUIApplication(); app.launchArguments=["-tavixo-demo"]; app.launch()
        XCTAssertTrue(app.staticTexts["DEMO LOCAL · datos ficticios"].waitForExistence(timeout:15))
        app.buttons["Mesas"].firstMatch.tap()
        let newOrder=app.buttons["new-order-table-3"]
        XCTAssertTrue(newOrder.waitForExistence(timeout:5)); newOrder.tap()
        let addProduct=app.buttons["add-00000000-0000-4000-8000-000000000010"]
        XCTAssertTrue(addProduct.waitForExistence(timeout:5)); addProduct.tap(); addProduct.tap()
        let note=app.descendants(matching:.any).matching(identifier:"line-note-00000000-0000-4000-8000-000000000010").firstMatch
        XCTAssertTrue(note.waitForExistence(timeout:5)); note.tap(); note.typeText("Sin cebolla")
        app.buttons["review-order"].tap()
        XCTAssertTrue(app.descendants(matching:.any).matching(identifier:"unit-price-00000000-0000-4000-8000-000000000010").firstMatch.waitForExistence(timeout:5))
        let unit=app.descendants(matching:.any).matching(identifier:"unit-price-00000000-0000-4000-8000-000000000010").firstMatch
        let subtotal=app.descendants(matching:.any).matching(identifier:"line-subtotal-00000000-0000-4000-8000-000000000010").firstMatch
        XCTAssertTrue((unit.value as? String ?? "").contains("120.00"))
        XCTAssertEqual(subtotal.label,"Subtotal de 2 unidades")
        XCTAssertTrue((subtotal.value as? String ?? "").contains("240.00"))
        // Review the selection before confirming; no live customer data or HTTP requests.
        for _ in 0..<5 {
            if app.buttons["send-order"].isHittable { break }; app.swipeUp()
        }
        XCTAssertTrue(app.staticTexts["Cantidad: 2"].exists)
        let preview=XCTAttachment(screenshot:app.screenshot()); preview.name="Pedido nativo demo"; preview.lifetime = .keepAlways; add(preview)
        app.buttons["send-order"].tap(); app.buttons["Confirmar envío"].tap()
        XCTAssertTrue(app.staticTexts["Comanda #14 confirmada"].waitForExistence(timeout:5))
        app.buttons["order-done"].tap()
        let order=app.staticTexts["Ver comanda #14"]
        XCTAssertTrue(order.waitForExistence(timeout:5)); order.tap()
        XCTAssertTrue(app.navigationBars["Comanda #14"].waitForExistence(timeout:5))
        XCTAssertTrue(app.staticTexts["Sin cebolla"].exists)
        app.buttons["add-round"].tap()
        let water=app.buttons["add-00000000-0000-4000-8000-000000000011"]
        XCTAssertTrue(water.waitForExistence(timeout:5)); water.tap()
        app.buttons["review-order"].tap()
        for _ in 0..<5 { if app.buttons["send-order"].isHittable { break }; app.swipeUp() }
        app.buttons["send-order"].tap(); app.buttons["Confirmar envío"].tap()
        XCTAssertTrue(app.staticTexts["Comanda #14 confirmada"].waitForExistence(timeout:5))
        app.buttons["order-done"].tap()
        XCTAssertTrue(app.staticTexts["1 × Agua fresca"].waitForExistence(timeout:5))
        let detail=XCTAttachment(screenshot:app.screenshot()); detail.name="Cuenta con segunda ronda"; detail.lifetime = .keepAlways; add(detail)
    }

}
