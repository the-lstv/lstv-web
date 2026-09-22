# 1.3.1-dev
- Updated LS v6.0.0-alpha.3 -> v6.0.0-alpha.5
- Login buttons now show proper state
- Action buttons now use LS.Effect handles instead of inline onclick handlers
- Fixed account switcher
- Added single-click login with Google & Discord
- Fixed server-side issue somehow causing preflights to take 10+ seconds on *some* browsers that handle requests without a body incorrectly (Firefox), which delayed every action, because why not waste time on pointless requests.

# 1.3.0-beta
- Updated LS v6.0.0-alpha.2 -> v6.0.0-alpha.3
- Moved window management from kernel to LS.WindowManager
- Moved navigation from kernel to LS.SPA
- Added desktop mode!
- Added system sound API
- Small shader performance & renedring improvements
- Fixed homepage animations
- A bunch of bug fixes all over the place
- Command palette has been changed to use the new bash terminal with new auto-completion features.
- Added a session/login manager for the desktop
- Added a new file manager
- Updated resource monitor
- Added a filesystem and environment

## 1.2.6-beta
- Updated LS v6.0.0-alpha.0 -> v6.0.0-alpha.2

## 1.2.5-beta
- Updated LS v5.2.9 -> v6.0.0-alpha.0
- Windows can now be maximized, pinned, & work better on mobile
- You can now pause/resume apps in the resource monitor
- Updated builtin apps (clock, text editor)
- Apps can now be open via URL (/app/:appId)

## 1.2.4-beta
- Updated LS v5.2.8 -> v5.2.9
- Customizeable corner radius
- Music player
- User settings

...
