from fastapi.testclient import TestClient

def test_get_system_info(client: TestClient):
                                                                                                        
                              
    response = client.get("/system/info")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
