const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const tests = [
  { name: 'Recherche Simple', file: 'simpleSearch.js' },
  { name: 'Recherche Avancée', file: 'advancedSearch.js' },
  { name: 'Appariement Wikidata', file: 'linkWikidata.js' }
];

async function waitForWarmup() {
  const port = process.env.PORT;
  const host = process.env.TEST_HOST;
  const versionUrl = `http://${host}:${port}/deces/api/v1/version`;
  const searchUrl = `http://${host}:${port}/deces/api/v1/search?deathDate=2020&lastName=dupont&firstName=jean&deathDepartment=33&fuzzy=false`;
  const frontendUrl = `http://${host}:${port}/search?advanced=true`;
  const timeoutMs = 90000;
  const retryDelayMs = 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const versionResponse = await fetch(versionUrl);
      if (!versionResponse.ok) {
        throw new Error(`version status ${versionResponse.status}`);
      }

      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`search status ${searchResponse.status}`);
      }

      const payload = await searchResponse.json();
      if ((payload?.response?.total || 0) > 0) {
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          await page.goto(frontendUrl);
          await page.waitForSelector('#ln', { timeout: 5000 });
        } finally {
          await browser.close();
        }
        console.log('✅ Warm-up UI: frontend, backend et donnees de reference prets');
        return;
      }
      throw new Error('reference search returned no result');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`⏳ Warm-up UI en attente: ${message}`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Warm-up UI impossible apres ${timeoutMs / 1000} secondes`);
}

let results = {
  total: tests.length,
  success: 0,
  failed: 0,
  details: [],
  steps: 0,
  stepsByTest: []
};

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n📋 Exécution du test: ${test.name}`);
    console.log('─'.repeat(50));

    const testProcess = spawn('node', [test.file], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    testProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });

    testProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      error += chunk;
      process.stderr.write(chunk);
    });

    testProcess.on('close', (code) => {
      const success = code === 0;
      const stepMatches = output.match(/^([✅✨])/gm);
      const steps = stepMatches ? stepMatches.length : 0;
      results.steps += steps;
      results.stepsByTest.push({ name: test.name, steps });
      results[success ? 'success' : 'failed']++;
      results.details.push({
        name: test.name,
        success,
        code,
        error: error || null,
        steps
      });

      console.log('─'.repeat(50));
      resolve();
    });
  });
}

async function runAllTests() {
  console.log('🚀 Démarrage de la suite de tests');
  console.log('='.repeat(50));
  await waitForWarmup();

  for (const test of tests) {
    await runTest(test);
  }

  // Affichage du bilan
  console.log('\n📊 BILAN DES TESTS');
  console.log('='.repeat(50));
  console.log(`Total des tests: ${results.total}`);
  console.log(`✅ Tests réussis: ${results.success}`);
  console.log(`❌ Tests échoués: ${results.failed}`);
  console.log(`\n🟩 Total des étapes passées: ${results.steps}`);
  results.stepsByTest.forEach(t => {
    console.log(`   - ${t.name}: ${t.steps} étapes passées`);
  });
  
  if (results.failed > 0) {
    console.log('\n🔍 Détails des échecs:');
    results.details
      .filter(test => !test.success)
      .forEach(test => {
        console.log(`\n❌ ${test.name}:`);
        if (test.error) {
          console.log(test.error);
        }
      });
  }

  console.log('\n✨ Fin de la suite de tests');
  process.exit(results.failed > 0 ? 1 : 0);
}

runAllTests(); 
