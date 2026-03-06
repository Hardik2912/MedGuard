# How to Share MedGuard with Friends 🤝

You have two main ways to share this app:

## 1. Local Network Sharing (Same Wi-Fi) 🏠
**Best for:** Showing it to someone sitting next to you.

1.  Make sure your laptop and your friend's phone are on the **same Wi-Fi network**.
2.  Look at your terminal where the app is running. You will see something like:
    ```
    ➜  Local:   http://localhost:5173/
    ➜  Network: http://192.168.1.5:5173/  <-- THIS ONE!
    ```
3.  Type that **Network URL** (e.g., `http://192.168.1.5:5173`) into your friend's phone browser.
4.  The app will load instantly!

## 2. Remote Sharing (Deployment) 🌍
**Best for:** Sending a link to someone far away.

The easiest way to put this online for free is using **Vercel** or **Netlify**.

### Option A: Vercel (Recommended)
1.  Create a GitHub account and push this code to a repository.
2.  Go to [vercel.com](https://vercel.com) and sign up.
3.  Click **"Add New Project"** and select your GitHub repo.
4.  Vercel will detect it's a Vite app. just click **Deploy**.
5.  You will get a link like `https://med-guard.vercel.app` to share with anyone!

### Option B: Quick Preview (Tunneling)
If you don't want to deploy yet, you can use a temporary tunnel.
1.  Stop the server (`Ctrl + C`).
2.  Run: `npx localtunnel --port 5173`
3.  It will give you a temporary URL (e.g., `https://rude-zebra-45.loca.lt`) that works anywhere for a few hours.
