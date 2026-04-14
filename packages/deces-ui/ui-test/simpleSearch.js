console.log('🚀 Démarrage du test de recherche simple');
const { chromium } = require('playwright');
(async () => {
  console.log('📝 Étape 1: Initialisation du navigateur');
  const browser = await chromium.launch({
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const port = process.env.PORT;
  const host = process.env.TEST_HOST;
  
  console.log('📝 Étape 2: Navigation vers la page de recherche');
  await page.goto(`http://${host}:${port}/search?advanced=true`);
  await page.waitForSelector('#ln');
  await page.click('[title="Recherche simplifiée"]');
  await page.waitForSelector('#q');
  console.log('✅ Page de recherche chargée');

  console.log('📝 Étape 3: Recherche de "dupont jean"');
  await page.fill('#q', 'dupont jean');
  await page.waitForFunction(() => window.location.search.includes('q=dupont+jean'));
  await page.waitForSelector('text=DUPONT Jean Pierre');
  console.log('✅ Recherche effectuée');
  await page.screenshot({ path: 'simpleSearchStep1.png' })

  console.log('📝 Étape 4: Sélection du résultat');
  await page.click('text=DUPONT Jean Pierre');
  console.log('✅ Résultat sélectionné');
  await page.screenshot({ path: 'simpleSearchStep2.png' })

  console.log('📝 Étape 5: Navigation vers le permalien');
  await Promise.all([
    page.waitForNavigation(),
    page.click('text=Permalien')
  ]);
  console.log('✅ Permalien chargé');
  await page.screenshot({ path: 'simpleSearchStep3.png' })

  console.log('📝 Étape 6: Vérification des détails');
  await page.click('text=Eysines 03/10/1932 - Pessac 16/01/2020');
  console.log('✅ Détails affichés');
  await page.screenshot({ path: 'simpleSearchStep4.png' })

  console.log('📝 Étape 7: Navigation vers Eysines');
  await page.click('text=Eysines');
  console.log('✅ Page Eysines chargée');
  await page.screenshot({ path: 'simpleSearchStep5.png' })

  console.log('📝 Étape 8: Sélection du code INSEE');
  await page.click('text=Eysines (33162)');
  console.log('✅ Code INSEE sélectionné');
  await page.screenshot({ path: 'simpleSearchStep6.png' })

  console.log('✨ Test de recherche simple terminé avec succès');
  await context.close();
  await browser.close();
})();
