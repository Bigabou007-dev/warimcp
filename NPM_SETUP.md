# WariMCP — npm Publish Setup

## One-Time Setup

### Step 1 — Create an npm Account
1. Go to https://www.npmjs.com/signup
2. Create an account with:
   - Username: (your preferred handle, e.g. `bigabou`)
   - Email: your main email
   - Password: strong, unique
3. Verify your email from the confirmation message

### Step 2 — Enable 2FA (Required for Publishing)
1. Log into npmjs.com
2. Click your avatar → **Account** → **Two-Factor Authentication**
3. Choose **Auth and Writes** (required for publish)
4. Scan the QR code with Google Authenticator or Authy
5. Save your backup codes securely

### Step 3 — Log In from Terminal

```bash
cd ~/automation/projects/warimcp
npm login
```

You'll be prompted for:
- Username
- Password
- Email
- OTP (from your authenticator app)

Verify login:
```bash
npm whoami
# should return your npm username
```

### Step 4 — Publish the Package

```bash
npm publish --access=public
```

> **Note:** The package name `warimcp` was confirmed available as of March 1, 2026.

### Step 5 — Verify on npm

Visit: https://www.npmjs.com/package/warimcp

You should see the package live within ~2 minutes.

---

## Future Publishes

Once logged in, Claude Code can handle all future publishes automatically:

```bash
# Bump version (patch / minor / major)
npm version patch   # 0.0.1 → 0.0.2
npm version minor   # 0.0.1 → 0.1.0

# Publish
npm publish --access=public
```

Or just tell Claude: "Publish warimcp version X.Y.Z" and it will handle the version bump and publish.

---

## Important Notes

- Do NOT run `npm publish` without bumping the version first — npm will reject duplicate versions
- The `--access=public` flag is required for the first publish of a scoped or new package
- npm sessions expire — re-run `npm login` if you get auth errors
