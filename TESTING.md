// Quick sanity checks for AI Studio components
// Run with: npm test (if jest is configured)

// Example test for project creation
const testCreateProject = async (apiUrl: string, projectName: string) => {
try {
const response = await fetch(`${apiUrl}/projects`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ name: projectName }),
});

    if (!response.ok) {
      console.error('❌ Create project failed');
      return false;
    }

    const data = await response.json();
    console.log('✅ Create project succeeded:', data.id);
    return data;

} catch (error) {
console.error('❌ Create project error:', error);
return false;
}
};

// Example test for listing projects
const testListProjects = async (apiUrl: string) => {
try {
const response = await fetch(`${apiUrl}/projects`);

    if (!response.ok) {
      console.error('❌ List projects failed');
      return false;
    }

    const data = await response.json();
    console.log('✅ List projects succeeded, count:', Array.isArray(data) ? data.length : 0);
    return data;

} catch (error) {
console.error('❌ List projects error:', error);
return false;
}
};

// Example test for health check
const testHealthCheck = async (apiUrl: string) => {
try {
const response = await fetch(`${apiUrl}/health`);

    if (!response.ok) {
      console.error('❌ Health check failed');
      return false;
    }

    const data = await response.json();
    console.log('✅ Health check passed:', data);
    return true;

} catch (error) {
console.error('❌ Health check error:', error);
return false;
}
};

// Run all tests
export const runAllTests = async () => {
const apiUrl = 'http://localhost:4000';

console.log('\n🧪 Running AI Studio Tests\n');

// Test 1: Health check
console.log('Test 1: Health Check');
await testHealthCheck(apiUrl);

// Test 2: Create project
console.log('\nTest 2: Create Project');
const project = await testCreateProject(apiUrl, 'Test Game ' + Date.now());

// Test 3: List projects
console.log('\nTest 3: List Projects');
await testListProjects(apiUrl);

// Test 4: Apply changes
if (project && project.id) {
console.log('\nTest 4: Apply Changes');
try {
const response = await fetch(`${apiUrl}/projects/${project.id}/apply`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
files: [{ path: 'src/test.txt', content: 'Test content' }],
}),
});

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Apply changes succeeded:', data);
      } else {
        console.error('❌ Apply changes failed');
      }
    } catch (error) {
      console.error('❌ Apply changes error:', error);
    }

}

console.log('\n✨ Tests Complete\n');
};
