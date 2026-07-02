# Exhibition Explorer Android APK Build Guide

This document describes how to compile and build the Android APK for the **Exhibition Explorer** application using Capacitor and the local build environment.

---

## 1. Prerequisites and Paths

The development environment has pre-configured JDK and Android SDK packages inside the workspace. To build successfully, you must reference these paths:

- **Workspace Path**: `c:\Users\zhang\Downloads\RemoteServer\ExhibitionExplorer`
- **JDK Directory**: `c:\Users\zhang\Downloads\RemoteServer\ExhibitionExplorer\.android-tools\jdk\jdk-21.0.11+10`
- **Android SDK Directory**: `c:\Users\zhang\Downloads\RemoteServer\ExhibitionExplorer\.android-tools\sdk`

---

## 2. Step-by-Step Build Instructions

Follow these steps to generate a fresh build:

### Step 1: Synchronize Capacitor Assets
This step copies the latest web application configuration and client assets into the Android native directory structure:
```powershell
npx cap sync
```

### Step 2: Define Environment Variables
You must set `JAVA_HOME` and `ANDROID_HOME` pointing to the pre-configured paths.

> [!WARNING]
> If setting variables using Windows `cmd`, ensure there is **no trailing space** before the chain operator `&&`, otherwise Java will throw an invalid directory error.
>
> **Correct syntax**: `set JAVA_HOME=path&&set ANDROID_HOME=path`

### Step 3: Clean and Compile
Navigate to the `android` project directory and use the Gradle Wrapper (`gradlew.bat`) to clean previous build caches and assemble the new package:
```powershell
cd android
.\gradlew.bat clean assembleDebug
```

### Step 4: Copy the Compiled APK to the Root
Once the compilation succeeds, the new debug package is generated inside the build outputs. Copy it to the workspace root folder:
```powershell
copy /Y .\app\build\outputs\apk\debug\app-debug.apk ..\ExhibitionExplorer.apk
```

---

## 3. Quick Automated One-Line Build Command

You can run the entire workflow in one command block from the root directory:

```powershell
npx cap sync && cmd /c "set JAVA_HOME=c:\Users\zhang\Downloads\RemoteServer\ExhibitionExplorer\.android-tools\jdk\jdk-21.0.11+10&&set ANDROID_HOME=c:\Users\zhang\Downloads\RemoteServer\ExhibitionExplorer\.android-tools\sdk&&cd android&&gradlew.bat clean assembleDebug&&copy /Y .\app\build\outputs\apk\debug\app-debug.apk ..\ExhibitionExplorer.apk"
```

Once the command finishes, the updated app package will be available in the root workspace folder: [ExhibitionExplorer.apk](file:///c:/Users/zhang/Downloads/RemoteServer/ExhibitionExplorer/ExhibitionExplorer.apk).
