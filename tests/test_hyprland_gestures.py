from fastapi.testclient import TestClient

def test_get_gestures(client: TestClient):
    response = client.get("/hyprland/gestures")
    assert response.status_code == 200
    data = response.json()
    assert "gestures" in data
    gestures = data["gestures"]
    assert len(gestures) > 0

                                                                      
    g = next((g for g in gestures if g["fingers"] == "3" and g["direction"] == "up"), None)
    assert g is not None
    assert g["action"] == "workspace"
    assert g["params"] == "+1"

def test_add_gesture(client: TestClient):
                                                         
    update = {
        "action": "add",
        "fingers": 3,
        "direction": "down",
        "gesture_action": "workspace",
        "params": "-1"
    }
    response = client.post("/hyprland/gestures", json=update)
    assert response.status_code == 200

            
    response = client.get("/hyprland/gestures")
    gestures = response.json()["gestures"]
    assert any(g["fingers"] == "3" and g["direction"] == "down" and g["action"] == "workspace" for g in gestures)

def test_delete_gesture(client: TestClient):
                                                          
    response = client.get("/hyprland/gestures")
    gestures = response.json()["gestures"]
    gesture = next((g for g in gestures if g["fingers"] == "3" and g["direction"] == "up"), None)

    assert gesture is not None

    update = {
        "action": "delete",
        "fingers": 3,
        "direction": "up",
        "gesture_action": "workspace",
        "old_raw": gesture["raw"]
    }
    response = client.post("/hyprland/gestures", json=update)
    assert response.status_code == 200

            
    response = client.get("/hyprland/gestures")
    gestures = response.json()["gestures"]
    assert not any(g["fingers"] == "3" and g["direction"] == "up" for g in gestures)
