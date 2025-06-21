const http = require('http');

// Test server endpoints
const tests = [
  {
    name: 'Health Check',
    path: '/health',
    method: 'GET'
  },
  {
    name: 'Users Endpoint',
    path: '/api/users',
    method: 'GET'
  },
  {
    name: 'Posts Endpoint',
    path: '/api/posts',
    method: 'GET'
  }
];

const HOST = 'localhost';
const PORT = process.env.PORT || 3000;

function makeRequest(test) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: test.path,
      method: test.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          test: test.name,
          status: res.statusCode,
          success: res.statusCode < 400,
          response: data
        });
      });
    });

    req.on('error', (error) => {
      reject({
        test: test.name,
        error: error.message,
        success: false
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject({
        test: test.name,
        error: 'Request timeout',
        success: false
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing Naksh Server...\n');
  console.log(`Server: http://${HOST}:${PORT}\n`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await makeRequest(test);
      
      if (result.success) {
        console.log(`✅ ${result.test} - Status: ${result.status}`);
        passed++;
      } else {
        console.log(`❌ ${result.test} - Status: ${result.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${error.test} - Error: ${error.error}`);
      failed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Server is running correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check server configuration.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
console.log('Checking if server is running...');
makeRequest({ name: 'Server Check', path: '/health', method: 'GET' })
  .then(() => {
    console.log('✅ Server is running!\n');
    runTests();
  })
  .catch(() => {
    console.log('❌ Server is not running!');
    console.log(`Please start the server first with: npm run dev`);
    console.log(`Or: npm start`);
    process.exit(1);
  });