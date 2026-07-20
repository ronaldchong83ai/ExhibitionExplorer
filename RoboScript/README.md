# 🤖 Firebase Test Lab Robo Scripts

This directory contains pre-configured Firebase Test Lab Robo scripts for automated handset compatibility testing of the **Exhibition Explorer** iOS (`.ipa`) & Android (`.apk`) builds.

---

## 🔑 Test Accounts Created

The database seed script ([prisma/seed_robo_accounts.js](file:///c:/Users/zhang/Downloads/RemoteServer/ExhibitionExplorer/prisma/seed_robo_accounts.js)) creates the following 4 dedicated test accounts:

| Role | Email | Password | Robo Script JSON File |
| :--- | :--- | :--- | :--- |
| **Visitor** | `test.visitor@exhibition.com` | `TestVisitor123!` | [robo_script_visitor.json](file:///c:/Users/zhang/Downloads/RemoteServer/ExhibitionExplorer/RoboScript/robo_script_visitor.json) |
| **Exhibitor** | `test.exhibitor@exhibition.com` | `TestExhibitor123!` | [robo_script_exhibitor.json](file:///c:/Users/zhang/Downloads/RemoteServer/ExhibitionExplorer/RoboScript/robo_script_exhibitor.json) |
| **Redemptor** | `test.redemptor@exhibition.com` | `TestRedemptor123!` | [robo_script_redemptor.json](file:///c:/Users/zhang/Downloads/RemoteServer/ExhibitionExplorer/RoboScript/robo_script_redemptor.json) |
| **Admin** | `test.admin@exhibition.com` | `TestAdmin123!` | [robo_script_admin.json](file:///c:/Users/zhang/Downloads/RemoteServer/ExhibitionExplorer/RoboScript/robo_script_admin.json) |

---

## 🚀 How to Run / Seed Database

Run the database seed command whenever deploying or resetting your environment:

```bash
node prisma/seed_robo_accounts.js
```

---

## 📱 How to Upload to Firebase Test Lab

1. Go to **Firebase Console → Test Lab → Run a Test**.
2. Select **iOS** and upload your `ExhibitionExplorer.ipa`.
3. Choose **Robo test**.
4. In **Additional Options → Robo Script**, click **Upload script** and select one of the JSON files in this directory (e.g. `robo_script_visitor.json`).
5. Run the test across your target device models.
