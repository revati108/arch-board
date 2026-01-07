"""
Tests for Hyprland config migration feature.
"""

import pytest
from plugins.hyprland.helpers.migration import HyprlandVersion, ConfigMigrator, MigrationResult
from plugins.hyprland.helpers.hyprlang import HyprConf, HyprLine, HyprValue


class TestHyprlandVersion:
    """Tests for HyprlandVersion parsing and detection."""
    
    def test_parse_simple_version(self):
        """Test parsing simple version string."""
        v = HyprlandVersion.parse("Hyprland v0.40.0")
        assert v is not None
        assert v.major == 0
        assert v.minor == 40
        assert v.patch == 0
    
    def test_parse_commit_version(self):
        """Test parsing version from commit output."""
        output = """Hyprland, built from branch main at commit ea444c330040716c9431e51b697395066928236d (v0.53.0).
Date: Tue Dec 31 12:00:00 2024
Tag: v0.53.0"""
        v = HyprlandVersion.parse(output)
        assert v is not None
        assert v.major == 0
        assert v.minor == 53
        assert v.patch == 0
    
    def test_parse_tag_line(self):
        """Test parsing version from Tag: line."""
        output = "Tag: v0.53.0"
        v = HyprlandVersion.parse(output)
        assert v is not None
        assert v.major == 0
        assert v.minor == 53
        assert v.patch == 0
    
    def test_parse_invalid(self):
        """Test parsing invalid version string."""
        v = HyprlandVersion.parse("no version here")
        assert v is None
    
    def test_supports_new_rules_old_version(self):
        """Test old version does not support new rules."""
        v = HyprlandVersion(major=0, minor=40, patch=0)
        assert not v.supports_new_window_rules()
    
    def test_supports_new_rules_new_version(self):
        """Test new version supports new rules."""
        v = HyprlandVersion(major=0, minor=53, patch=0)
        assert v.supports_new_window_rules()
    
    def test_supports_new_rules_future_version(self):
        """Test future major version supports new rules."""
        v = HyprlandVersion(major=1, minor=0, patch=0)
        assert v.supports_new_window_rules()
    
    def test_to_string(self):
        """Test version string representation."""
        v = HyprlandVersion(major=0, minor=53, patch=1)
        assert str(v) == "0.53.1"


class TestConfigMigrator:
    """Tests for ConfigMigrator migration logic."""
    
    def _make_conf(self, lines: list) -> HyprConf:
        """Helper to create a HyprConf from key-value tuples."""
        return HyprConf(
            lines=[
                HyprLine(
                    key=k,
                    value=HyprValue(raw=v, parts=[])
                )
                for k, v in lines
            ],
            variables={},
            categories=[]
        )
    
    def test_needs_migration_empty(self):
        """Test empty config does not need migration."""
        conf = self._make_conf([])
        assert not ConfigMigrator.needs_migration(conf)
    
    def test_needs_migration_windowrulev2(self):
        """Test windowrulev2 triggers migration."""
        conf = self._make_conf([
            ("windowrulev2", "float,class:^(kitty)$")
        ])
        assert ConfigMigrator.needs_migration(conf)
    
    def test_needs_migration_windowrulev2_case_insensitive(self):
        """Test WindowRuleV2 case insensitive detection."""
        conf = self._make_conf([
            ("WindowRuleV2", "float,class:^(kitty)$")
        ])
        assert ConfigMigrator.needs_migration(conf)
    
    def test_needs_migration_legacy_windowrule(self):
        """Test legacy windowrule without match: triggers migration."""
        conf = self._make_conf([
            ("windowrule", "float, ^(kitty)$")
        ])
        assert ConfigMigrator.needs_migration(conf)
    
    def test_needs_migration_legacy_layerrule(self):
        """Test legacy layerrule without match: triggers migration."""
        conf = self._make_conf([
            ("layerrule", "blur, waybar")
        ])
        assert ConfigMigrator.needs_migration(conf)
    
    def test_needs_migration_new_syntax(self):
        """Test new syntax with match: does not trigger migration."""
        conf = self._make_conf([
            ("windowrule", "float on, match:class ^(kitty)$")
        ])
                                                                   
                                                
        conf2 = HyprConf(
            lines=[
                HyprLine(key="windowrule", value=HyprValue(raw="float on, match:class ^(kitty)$", parts=[]))
            ],
            variables={},
            categories=[]
        )
        assert not ConfigMigrator.needs_migration(conf2)
    
    def test_needs_migration_old_option(self):
        """Test old option name triggers migration."""
        conf = self._make_conf([
            ("misc:new_window_takes_over_fullscreen", "1")
        ])
        assert ConfigMigrator.needs_migration(conf)
    
    def test_migrate_windowrulev2(self):
        """Test migrating windowrulev2 rule."""
        conf = self._make_conf([
            ("windowrulev2", "float,class:^(kitty)$")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        assert conf.lines[0].key == "windowrule"
        assert "match:class ^(kitty)$" in conf.lines[0].value.raw
        assert "float on" in conf.lines[0].value.raw
    
    def test_migrate_legacy_windowrule(self):
        """Test migrating legacy windowrule."""
        conf = self._make_conf([
            ("windowrule", "float, ^(firefox)$")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        assert "match:class ^(firefox)$" in conf.lines[0].value.raw
        assert "float on" in conf.lines[0].value.raw
    
    def test_migrate_with_commas_in_pattern(self):
        """Test migrating rules with commas inside parentheses."""
        conf = self._make_conf([
            ("windowrulev2", "float,title:^(foo, bar)$")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
                                                      
        assert "match:title ^(foo, bar)$" in conf.lines[0].value.raw
        assert "float on" in conf.lines[0].value.raw
    
    def test_migrate_multiple_conditions(self):
        """Test migrating rules with multiple match conditions."""
        conf = self._make_conf([
            ("windowrule", "opacity 0.9, class:^(google-chrome)$, title:(.*ArchBoard.*)")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        raw = conf.lines[0].value.raw
        assert "match:class ^(google-chrome)$" in raw
        assert "match:title (.*ArchBoard.*)" in raw
        assert "opacity 0.9" in raw
    
    def test_migrate_layerrule(self):
        """Test migrating layerrule."""
        conf = self._make_conf([
            ("layerrule", "blur, waybar")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        assert "blur on" in conf.lines[0].value.raw
        assert "match:namespace waybar" in conf.lines[0].value.raw
    
    def test_migrate_layerrule_stayfocused(self):
        """Test stayfocused -> stay_focused transformation."""
        conf = self._make_conf([
            ("layerrule", "stayfocused, wofi")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        assert "stay_focused on" in conf.lines[0].value.raw
    
    def test_migrate_layerrule_ignorealpha(self):
        """Test ignorealpha -> ignore_alpha transformation."""
        conf = self._make_conf([
            ("layerrule", "ignorealpha 0.5, swaync-control-center")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        assert "ignore_alpha 0.5" in conf.lines[0].value.raw
    
    def test_migrate_layerrule_ignorezero(self):
        """Test ignorezero -> ignore_alpha 0 transformation."""
        conf = self._make_conf([
            ("layerrule", "ignorezero, rofi")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        assert "ignore_alpha 0" in conf.lines[0].value.raw
    
    def test_migrate_renamed_option(self):
        """Test renaming misc:new_window_takes_over_fullscreen."""
        conf = self._make_conf([
            ("misc:new_window_takes_over_fullscreen", "1")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.renamed_options == 1
        assert conf.lines[0].key == "misc:on_focus_under_fullscreen"
    
    def test_needs_migration_master_inherit_fullscreen(self):
        """Test master:inherit_fullscreen triggers migration."""
        conf = self._make_conf([
            ("master:inherit_fullscreen", "1")
        ])
        assert ConfigMigrator.needs_migration(conf)
    
    def test_migrate_master_inherit_fullscreen(self):
        """Test renaming master:inherit_fullscreen -> misc:on_focus_under_fullscreen."""
        conf = self._make_conf([
            ("master:inherit_fullscreen", "1")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.renamed_options == 1
        assert conf.lines[0].key == "misc:on_focus_under_fullscreen"
        assert conf.lines[0].value.raw == "1"
    
    def test_migrate_move_cursor_percentage(self):
        """Test migrating move onscreen cursor with percentage."""
        conf = self._make_conf([
            ("windowrule", "float, move onscreen cursor -50% -50%, class:org.gnome.Calculator")
        ])
        result = ConfigMigrator.migrate(conf)
        
        assert result.migrated_rules == 1
        raw = conf.lines[0].value.raw
        assert "match:class org.gnome.Calculator" in raw
        assert "cursor_x" in raw
        assert "cursor_y" in raw
    
    def test_get_migration_summary(self):
        """Test generating migration summary."""
        conf = self._make_conf([
            ("windowrulev2", "float,class:^(kitty)$"),
            ("windowrule", "opacity 0.9, ^(firefox)$"),
            ("layerrule", "blur, waybar"),
            ("misc:new_window_takes_over_fullscreen", "1")
        ])
        
        summary = ConfigMigrator.get_migration_summary(conf)
        
        assert "2 legacy window rules" in summary
        assert "1 legacy layer rules" in summary
        assert "new_window_takes_over_fullscreen" in summary


class TestMigrationResult:
    """Tests for MigrationResult dataclass."""
    
    def test_result_creation(self):
        """Test creating a migration result."""
        result = MigrationResult(
            migrated_rules=5,
            renamed_options=1,
            backup_path=None
        )
        
        assert result.migrated_rules == 5
        assert result.renamed_options == 1
        assert result.backup_path is None
