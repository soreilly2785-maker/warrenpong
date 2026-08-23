# 🚀 Deploying WarrenPong to Cloudflare Pages (100% Free & Unlimited)

WarrenPong is built as a **100% serverless, zero-backend web application**. It uses native **WebRTC Peer-to-Peer DataChannels** to stream 45Hz game ticks directly between players' devices with zero server cost, zero lag, and unlimited free bandwidth!

---

## ⚡ Method 1: Instant Deployment via Cloudflare Dashboard (Easiest - 2 Minutes)

1. Log into your free [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, navigate to **Compute (Workers & Pages)** > **Pages**.
3. Click **Create Application** > **Pages** > **Upload Assets**.
4. Give your project a name (e.g. `warrenpong`).
5. Drag and drop the **`public`** folder into the upload box (or select the `public` directory).
6. Click **Deploy Site**!

🎉 Your game is now live globally at `https://warrenpong.pages.dev`!

---

## 💻 Method 2: 1-Command CLI Deployment via Wrangler

If you have Node.js installed, you can deploy in one command:

```bash
# 1. Deploy the public directory to Cloudflare Pages
npx wrangler pages deploy public --project-name=warrenpong
```

---

## 🔗 Method 3: Continuous Deployment via GitHub (Auto-Updates on Git Push)

1. Push this repository to GitHub.
2. In Cloudflare Pages, click **Connect to Git** and select your repository.
3. In **Build Settings**:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
4. Click **Save and Deploy**.

Every time you commit changes, Cloudflare will automatically build and deploy the updated version in seconds!

---

## 🎮 How Online Multiplayer Works
* **Host a Room:** Click **Create Room** or **Quick Play**. Share the 4-letter room code or the live QR Code / link.
* **Join a Room:** Friends can scan the QR code on their phone or click the link `https://your-domain.pages.dev/#room=LQB2` to immediately connect and play!
* **Solo Mode:** Solo vs AI works 100% offline with zero internet connection required.
