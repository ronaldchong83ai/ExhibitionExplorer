async function testApi() {
  const url = 'http://localhost:3003';
  
  // 1. Log in
  console.log("Logging in as admin...");
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ronaldzhang83@gmail.com', password: 'Welcome123' })
  });
  
  const loginData = await loginRes.json();
  console.log("Login result:", loginData);
  
  const cookie = loginRes.headers.get('set-cookie');
  console.log("Session cookie:", cookie);
  
  if (!cookie) {
    console.error("No session cookie returned.");
    return;
  }
  
  // 2. Fetch exhibitions
  console.log("Fetching exhibitions...");
  const exRes = await fetch(`${url}/api/admin/exhibitions`, {
    headers: { 'Cookie': cookie }
  });
  const exData = await exRes.json();
  console.log("Exhibitions:", exData);
  
  if (exData.data && exData.data.length > 0) {
    const exId = exData.data[0].id;
    console.log(`Fetching home page info for exhibition ${exId}...`);
    
    // 3. Fetch home info
    const homeRes = await fetch(`${url}/api/admin/home-info?exhibitionId=${exId}`, {
      headers: { 'Cookie': cookie }
    });
    const homeData = await homeRes.json();
    console.log("Home Page Info response:", homeData);
  } else {
    console.error("No exhibitions found.");
  }
}

testApi().catch(console.error);
