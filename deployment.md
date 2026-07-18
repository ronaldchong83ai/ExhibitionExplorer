# Exhibition Explorer Deployment Guide

This document describes how to deploy the **Exhibition Explorer** application to the staging server. Future developer agents and maintainers should read and follow this guide.

---

## 1. Environment Details

- **Staging Server IP**: `143.47.99.151`
- **SSH User**: `ubuntu`
- **SSH Private Key Path (Local)**: `c:\Users\zhang\Downloads\RemoteServer\ssh-key-2025-09-07.key`
- **Server Application Directory**: `/home/ubuntu/ExhibitionExplorer`
- **Database**: PostgreSQL (local port `5432` on the server)
- **Deployment Process Manager**: PM2
- **External Web Port**: Staging Nginx forwards request traffic from the domain to PM2 listening on port `3003`.

---

## 2. Automated Deployment (Recommended)

An automated deployment Python script exists on the development machine.

### Run Script Command:
```powershell
python C:\Users\zhang\.gemini\antigravity-ide\scratch\deploy_remote.py
```

### What the script does:
1. Packages the workspace files into a `ExhibitionExplorer.zip` file (excluding `node_modules`, `.next`, etc.).
2. SCPs the zip package to the remote staging server at `ubuntu@143.47.99.151:~/`.
3. Decompresses the zip into `/home/ubuntu/ExhibitionExplorer`.
4. Refreshes the server-side database URL configuration in `.env`.
5. Runs `npm install`, `npx prisma generate`, `npx prisma db push`, and compiles the Next.js production build (`npm run build`).
6. Deletes any active PM2 instances named `exhibition-explorer` and restarts the application on port `3003`.
7. Saves the PM2 process list.

---

## 3. Manual Step-by-Step Deployment

If you need to deploy changes manually, run the following steps:

### Step 1: Zip the Local Source Code
Create a zip file containing the source code. Exclude temporary files and build folders such as `node_modules`, `.git`, `.next`, and local logs.

### Step 2: Upload to Server
Upload the zip archive via SCP:
```powershell
scp -i c:\Users\zhang\Downloads\RemoteServer\ssh-key-2025-09-07.key -o StrictHostKeyChecking=no ExhibitionExplorer.zip ubuntu@143.47.99.151:~/
```

### Step 3: Decompress and Set Up Environment
Connect to the server via SSH and prepare the build context:
```bash
ssh -i c:\Users\zhang\Downloads\RemoteServer\ssh-key-2025-09-07.key ubuntu@143.47.99.151
unzip -o ~/ExhibitionExplorer.zip -d ~/ExhibitionExplorer
cd ~/ExhibitionExplorer
```

### Step 4: Configure Staging Environment Variables
Append the staging PostgreSQL database configuration to the environment file:
```bash
sed -i '/DATABASE_URL/d' .env
echo 'DATABASE_URL="postgresql://exhibition_user:ExhibitionPassword123@127.0.0.1:5432/exhibition_explorer"' >> .env
```

### Step 5: Install Dependencies & Run Database Migrations
Generate Prisma clients and update database tables:
```bash
npm install
npx prisma generate
npx prisma db push
```

### Step 6: Build & Restart the Server
Compile the Next.js production code bundle and launch the daemon via PM2:
```bash
npm run build
pm2 delete exhibition-explorer || true
pm2 start npm --name "exhibition-explorer" -- run start -- --port 3003
pm2 save
```

---

## 4. Post-Deployment Maintenance

### A. Restarting the Application
To restart the server instance to pick up new configuration changes or environment variables, run:
```powershell
ssh -i c:\Users\zhang\Downloads\RemoteServer\ssh-key-2025-09-07.key ubuntu@143.47.99.151 "pm2 restart exhibition-explorer"
```

### B. Invalidating the Server Cache
To clear in-memory cache layers (such as cached database configurations or exhibition lists) after updates, run:
```powershell
ssh -i c:\Users\zhang\Downloads\RemoteServer\ssh-key-2025-09-07.key ubuntu@143.47.99.151 "cd ~/ExhibitionExplorer && node prisma/invalidate_cache.js"
```

### C. Viewing Live Server Logs
To tail logs for troubleshooting and diagnostics, run:
```powershell
ssh -i c:\Users\zhang\Downloads\RemoteServer\ssh-key-2025-09-07.key ubuntu@143.47.99.151 "pm2 logs exhibition-explorer"
```

---

## 5. iOS Code Signing and IPA Signing Configuration

The current GitHub Actions workflow is set up to generate an **unsigned `.ipa`** file by bypassing the code signing requirements. This is suitable for debugging, emulator use, or sideloading (e.g., AltStore/TrollStore).

If you want to distribute the app through TestFlight or the App Store, you must sign the `.ipa` file. Follow these steps to configure iOS certificates and signing in GitHub Actions:

### Step 1: Prepare Your Certificates & Provisioning Profile
1. **Export `.p12` Certificate**: Open **Keychain Access** on a Mac, find your iOS Distribution/Development Certificate, right-click, and select **Export...** to save it as a `.p12` file. Note the password used to encrypt it.
2. **Download Provisioning Profile**: Download the matching provisioning profile (`.mobileprovision`) from your Apple Developer account portal.
3. **Convert to Base64 (Windows/Mac)**:
   - On Mac:
     ```bash
     base64 -i my-cert.p12 | pbcopy
     base64 -i my-profile.mobileprovision | pbcopy
     ```
   - On Windows (PowerShell):
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("my-cert.p12")) | clip
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("my-profile.mobileprovision")) | clip
     ```

### Step 2: Configure GitHub Secrets
In your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and create the following secrets:
- `BUILD_CERTIFICATE_BASE64`: The base64-encoded string of your `.p12` certificate.
- `P12_PASSWORD`: The encryption password for your `.p12` file.
- `BUILD_PROVISION_PROFILE_BASE64`: The base64-encoded string of your `.mobileprovision` file.
- `KEYCHAIN_PASSWORD`: A random temporary password of your choice (e.g., `tempkeychainpass123`) which GitHub Actions will use to lock/unlock a temporary macOS keychain.

### Step 3: Update GitHub Actions Workflow
Uncomment or add the keychain-installation step in your `.github/workflows/deploy-ios.yml` before the archive step:

```yaml
      # Install the certificate and provisioning profile on the Mac runner
      - name: Install Apple certificate and provisioning profile
        env:
          BUILD_CERTIFICATE_BASE64: ${{ secrets.BUILD_CERTIFICATE_BASE64 }}
          P12_PASSWORD: ${{ secrets.P12_PASSWORD }}
          BUILD_PROVISION_PROFILE_BASE64: ${{ secrets.BUILD_PROVISION_PROFILE_BASE64 }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          # Create variables
          CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
          PP_PATH=$RUNNER_TEMP/build_pp.mobileprovision
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          # Import certificate and provisioning profile from secrets
          echo -n "$BUILD_CERTIFICATE_BASE64" | base64 --decode -o $CERTIFICATE_PATH
          echo -n "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode -o $PP_PATH

          # Create temporary keychain
          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          # Import certificate into keychain
          security import $CERTIFICATE_PATH -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          
          # Apply provisioning profile
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          cp $PP_PATH ~/Library/MobileDevice/Provisioning\ Profiles/
```

Then, configure the `Archive Xcode Project` step to allow code signing:
```yaml
      - name: Archive Xcode Project
        run: |
          xcodebuild archive \
            -project ios/App/App.xcodeproj \
            -scheme App \
            -configuration Release \
            -sdk iphoneos \
            -archivePath build/App.xcarchive
```

