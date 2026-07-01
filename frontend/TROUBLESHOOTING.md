# 🔧 Troubleshooting Guide

## Black Boxes/Artifacts on Dashboard

If you see black boxes or dark rectangles on your dashboard, here are the solutions:

### Solution 1: Browser DevTools Overlay
**Cause:** Browser developer tools console is open and overlaying the content.

**Fix:**
1. Press `F12` or `Ctrl+Shift+I` to toggle DevTools
2. Close the DevTools completely
3. Refresh the page (`Ctrl+R` or `F5`)

### Solution 2: Clear Browser Cache
**Cause:** Old cached CSS/JS files

**Fix:**
1. Press `Ctrl+Shift+Delete` (Chrome/Edge)
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh: `Ctrl+F5` (hard refresh)

### Solution 3: Disable Browser Extensions
**Cause:** Ad blockers or extensions interfering

**Fix:**
1. Open in Incognito/Private mode: `Ctrl+Shift+N`
2. Or disable extensions one by one
3. Test the app

### Solution 4: Console Overlay
**Cause:** Vite error overlay showing

**Fix:**
1. Check browser console (`F12`)
2. Fix any errors shown
3. Or press `Esc` to dismiss overlay
4. Refresh the page

### Solution 5: Restart Dev Server
**Cause:** Hot Module Replacement (HMR) issue

**Fix:**
```bash
# Stop the server (Ctrl+C)
npm run dev
```

---

## Other Common Issues

### Issue: Sidebar Not Showing
**Fix:**
- Check screen width (sidebar hidden on mobile <768px)
- Click hamburger menu button (☰) on mobile
- Refresh page

### Issue: Progress Ring Not Updating
**Fix:**
- Click "Show" on Quick Log card
- Complete an exercise (checkbox)
- Progress should increase from 75% to 80%

### Issue: Calendar Not Displaying
**Fix:**
- Click "View Calendar" button
- If blank, check date is after June 2026
- Red dots show on June 29, July 5, July 12

### Issue: Notifications Not Working
**Fix:**
1. Click bell icon
2. Click "Test" button
3. Allow notifications when prompted
4. Check browser notification settings

### Issue: Can't Login
**Fix:**
- Patient account email: `patient@gmail.com`
- Patient account password: `patient123`
- Complete reCAPTCHA
- Check console for errors

---

## Browser Compatibility

### Recommended Browsers:
- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

### Not Supported:
- ❌ Internet Explorer
- ❌ Chrome <80
- ❌ Firefox <78

---

## Performance Issues

### Slow Loading
**Fix:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### High Memory Usage
**Fix:**
1. Close unused browser tabs
2. Clear browser cache
3. Restart browser
4. Restart dev server

---

## PWA Installation Issues

### Can't Install on Mobile
**Android:**
1. Open in Chrome
2. Menu → "Add to Home Screen"
3. If option missing, check manifest.json

**iOS:**
1. Open in Safari (not Chrome)
2. Share button → "Add to Home Screen"
3. Works in Safari only

### Offline Mode Not Working
**Fix:**
1. Check service worker registration
2. Console → Application → Service Workers
3. Click "Update" or "Unregister"
4. Refresh and try again

---

## Development Issues

### Build Fails
```bash
# Clean and rebuild
npm run build

# If fails, check:
# 1. No syntax errors in JSX
# 2. All imports exist
# 3. Node version ≥18
```

### Hot Reload Not Working
```bash
# Restart Vite server
Ctrl+C
npm run dev
```

### Port Already in Use
```bash
# Kill process on port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Then restart:
npm run dev
```

---

## Styling Issues

### CSS Not Applying
1. Check file imported in component
2. Clear browser cache (`Ctrl+F5`)
3. Check CSS class names match
4. Inspect element (`F12`)

### Responsive Not Working
1. Test with DevTools device toolbar (`Ctrl+Shift+M`)
2. Try different devices
3. Clear cache
4. Check viewport meta tag

---

## Quick Diagnostic

Run this in browser console (`F12`):

```javascript
// Check if React is loaded
console.log('React:', typeof React !== 'undefined' ? '✓' : '✗')

// Check if service worker is registered
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length > 0 ? '✓' : '✗')
})

// Check notifications permission
console.log('Notifications:', Notification.permission)

// Check current route
console.log('Route:', window.location.pathname)
```

---

## Still Having Issues?

### Check Console Errors
1. Press `F12`
2. Go to Console tab
3. Look for red errors
4. Copy error message

### Check Network Tab
1. Press `F12`
2. Go to Network tab
3. Refresh page
4. Check if all files load (green status)
5. Red = failed to load

### Check Application Tab
1. Press `F12`
2. Go to Application tab
3. Check:
   - Manifest
   - Service Workers
   - Cache Storage
   - Local Storage

---

## Clean Slate Reset

If nothing works, try this:

```bash
# 1. Stop dev server
Ctrl+C

# 2. Delete dependencies
rm -rf node_modules
rm package-lock.json

# 3. Clear npm cache
npm cache clean --force

# 4. Reinstall
npm install

# 5. Rebuild
npm run build

# 6. Start fresh
npm run dev
```

Then:
- Clear browser cache (`Ctrl+Shift+Delete`)
- Hard refresh (`Ctrl+F5`)
- Open in Incognito mode

---

## Need More Help?

1. **Check Console** - Most issues show error messages
2. **Try Incognito** - Rules out extension conflicts
3. **Different Browser** - Tests if browser-specific
4. **Restart Computer** - Clears all processes
5. **Fresh Clone** - Tests if project corrupted

---

## Success Checklist

Your dashboard should show:
- ✅ White background
- ✅ Green sidebar (or hamburger menu on mobile)
- ✅ Welcome banner with progress ring
- ✅ Quick Log card (click Show to expand)
- ✅ Upcoming Appointment card
- ✅ 4 colorful therapy cards
- ✅ Recent Notes section
- ✅ No black boxes or artifacts
- ✅ Smooth animations
- ✅ Responsive on all sizes

If all items check out, you're good to go! 🎉

---

**Last Updated:** Build successful (341.39 KB total)
