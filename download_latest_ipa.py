import os
import sys
import re
import zipfile
import urllib.request
import urllib.error
import json
import subprocess

def get_git_repo_info():
    try:
        url = subprocess.check_output(["git", "config", "--get", "remote.origin.url"], stderr=subprocess.DEVNULL).decode("utf-8").strip()
        # Parse owner and repo from url (ssh or HTTPS)
        # e.g., https://github.com/owner/repo.git or git@github.com:owner/repo.git
        match = re.search(r"github\.com[:/]([^/]+)/([^.]+)", url)
        if match:
            return match.group(1), match.group(2)
    except Exception:
        pass
    return None, None

def download_artifact(owner, repo, token):
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    # 1. Fetch artifacts for the repository
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/artifacts?name=ExhibitionExplorer-iOS-ipa&per_page=1"
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"Error fetching artifacts: HTTP {e.code} - {e.reason}")
        if e.code == 401:
            print("Please check that your GitHub token is valid and has 'actions:read' permissions.")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False
        
    artifacts = data.get("artifacts", [])
    if not artifacts:
        print("No build artifacts named 'ExhibitionExplorer-iOS-ipa' found.")
        print("Please check that your GitHub Action workflow has run successfully at least once.")
        return False
        
    latest_artifact = artifacts[0]
    artifact_id = latest_artifact["id"]
    download_url = latest_artifact["archive_download_url"]
    print(f"Found latest artifact (ID: {artifact_id}, Created at: {latest_artifact['created_at']})")
    
    # 2. Download the artifact zip file
    print("Downloading artifact zip file...")
    download_req = urllib.request.Request(download_url, headers=headers)
    zip_path = "ExhibitionExplorer_ipa.zip"
    
    try:
        with urllib.request.urlopen(download_req) as response, open(zip_path, "wb") as out_file:
            out_file.write(response.read())
    except Exception as e:
        print(f"Failed to download artifact: {e}")
        return False
        
    # 3. Extract the IPA from the zip file
    print("Extracting IPA...")
    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            # The zip file contains the packaged ExhibitionExplorer.ipa file
            zip_ref.extractall(".")
        os.remove(zip_path)
        print("Success! 'ExhibitionExplorer.ipa' has been downloaded and extracted to the project root.")
        return True
    except Exception as e:
        print(f"Failed to extract zip file: {e}")
        if os.path.exists(zip_path):
            os.remove(zip_path)
        return False

def main():
    print("=== GitHub Actions IPA Downloader ===")
    owner, repo = get_git_repo_info()
    if not owner or not repo:
        print("Error: Could not retrieve GitHub owner and repository name from git configuration.")
        owner = input("Enter GitHub repository owner (username or org): ").strip()
        repo = input("Enter GitHub repository name: ").strip()
        if not owner or not repo:
            print("Owner and repository are required.")
            sys.exit(1)
            
    print(f"Target repository: {owner}/{repo}")
    
    # Check for token in environment or prompt
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("\nNote: A GitHub Personal Access Token (PAT) with 'actions:read' permissions is required to download artifacts.")
        print("You can generate one at: https://github.com/settings/tokens")
        token = input("Enter your GitHub Personal Access Token: ").strip()
        
    if not token:
        print("A GitHub token is required to authenticate with the API.")
        sys.exit(1)
        
    success = download_artifact(owner, repo, token)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
