import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from arch_board.main import app
from arch_board.plugins.hyprland.helpers.migration import HyprlandVersion

client = TestClient(app)

@pytest.fixture
def mock_config(tmp_path):
    config_file = tmp_path / "hyprland.conf"
    config_file.write_text("")
    with patch("arch_board.plugins.hyprland.CONFIG_PATH", str(config_file)):
        yield config_file

def test_window_rule_v0_53_plus(mock_config):
    with patch("arch_board.plugins.hyprland.helpers.migration.HyprlandVersion.detect") as mock_detect:
        mock_detect.return_value = HyprlandVersion(0, 53, 0)
        
        response = client.post("/hyprland/windowrules", json={
            "effect": "float",
            "match": "class:^kitty$"
        })
        assert response.status_code == 200
        
        content = mock_config.read_text()
        assert "windowrule = float on, match:class ^kitty$" in content

def test_window_rule_legacy(mock_config):
    with patch("arch_board.plugins.hyprland.helpers.migration.HyprlandVersion.detect") as mock_detect:
        mock_detect.return_value = HyprlandVersion(0, 52, 0)
        
        response = client.post("/hyprland/windowrules", json={
            "effect": "float",
            "match": "class:^kitty$"
        })
        assert response.status_code == 200
        
        content = mock_config.read_text()
        assert "windowrulev2 = float,class:^kitty$" in content

def test_layer_rule_v0_53_plus(mock_config):
    with patch("arch_board.plugins.hyprland.helpers.migration.HyprlandVersion.detect") as mock_detect:
        mock_detect.return_value = HyprlandVersion(0, 53, 0)
        
        response = client.post("/hyprland/layerrules", json={
            "effect": "blur",
            "namespace": "waybar"
        })
        assert response.status_code == 200
        
        content = mock_config.read_text()
        assert "layerrule = blur on, match:namespace waybar" in content
