import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(4);
});
test('catálogo real, detalhes e nenhum instalador fictício', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Grandes ideias. Ferramentas abertas.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Instalar', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'MolaStruct', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'MolaStruct' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Sapatas e blocos sobre 1 a 4 estacas')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Versões disponíveis' }).click();
  await expect(
    dialog.getByText('Os pacotes de instalação ainda não foram publicados.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
test('busca com acentos, filtros e ausência de resultados', async ({ page }) => {
  await page
    .getByRole('textbox', { name: 'Buscar aplicativos por nome ou descrição' })
    .fill('fundacoes');
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.locator('.product-title')).toHaveText(['GeoSPT', 'MolaStruct']);
  await page
    .getByRole('textbox', { name: 'Buscar aplicativos por nome ou descrição' })
    .fill('inexistente');
  await expect(page.getByRole('heading', { name: 'Nenhum aplicativo encontrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.product-card')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Todas as áreas' }).selectOption('Concreto armado');
  await expect(page.locator('.product-title')).toHaveText('ConsoloStruct');
});
test('lista persistente e menu de versões', async ({ page }) => {
  await page.getByRole('button', { name: 'Visualização em lista' }).click();
  await expect(page.locator('.list-layout')).toBeVisible();
  await page.reload();
  await expect(page.locator('.list-layout')).toBeVisible();
  await page.getByLabel('Opções do aplicativo: ConsoloStruct').click();
  await page.getByRole('button', { name: 'Escolher versão', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Versões disponíveis' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
test('oculta e restaura aplicativos pelas configurações', async ({ page }) => {
  await page.getByLabel('Opções do aplicativo: MolaStruct').click();
  await page.getByRole('button', { name: 'Ocultar aplicativo', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar todos', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await page.getByRole('button', { name: 'Todos os aplicativos', exact: false }).first().click();
  await expect(page.locator('.product-card')).toHaveCount(4);
});
test('tema, idioma e atalhos funcionam e persistem', async ({ page }) => {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Escuro', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(21, 27, 38)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Idioma da interface').selectOption('en');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('textbox', { name: 'Search applications by name or description' }),
  ).toBeFocused();
});
test('biblioteca vazia e downloads não simulam instalações', async ({ page }) => {
  await page.getByRole('button', { name: 'Instalados', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sua próxima ferramenta começa aqui.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Atualizações', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Tudo em dia por aqui.' })).toBeVisible();
  await page.getByRole('button', { name: 'Downloads', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum download por enquanto.' })).toBeVisible();
});
test('layouts não criam rolagem horizontal', async ({ page }) => {
  for (const width of [1320, 880, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('ArmaduraStruct tem identidade, detalhes e categoria próprios', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Todas as áreas' }).selectOption('Detalhamento');
  await expect(page.locator('.product-title')).toHaveText('ArmaduraStruct');
  await expect(page.locator('.product-card .product-icon img')).toHaveAttribute(
    'src',
    '/assets/armadurastruct-hephaestus.webp',
  );
  await page.getByRole('button', { name: 'ArmaduraStruct', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ArmaduraStruct' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Máscaras DXF e DWG processadas localmente'),
  ).toBeVisible();
});

test('GeoSPT usa a arte oficial em Fundações e mantém o fallback sem pacotes', async ({ page }) => {
  await page
    .getByRole('textbox', { name: 'Buscar aplicativos por nome ou descrição' })
    .fill('GeoSPT');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card .product-icon img')).toHaveAttribute(
    'src',
    '/assets/geosptstruct-athena.webp',
  );
  await expect(page.locator('.product-card .product-icon img')).toHaveJSProperty(
    'naturalWidth',
    768,
  );
  await page.getByRole('button', { name: 'GeoSPT', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'GeoSPT' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name: 'Versões disponíveis' }).click();
  await expect(
    dialog.getByText('Os pacotes de instalação ainda não foram publicados.'),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Instalar', exact: true })).toHaveCount(0);
});

test('GeoSPT carrega a mesma arte local no card, na lista e no detalhe, nos dois temas', async ({
  page,
}) => {
  const external: string[] = [];
  await page.route(
    (url) => url.origin !== 'http://127.0.0.1:1420',
    (route) => {
      external.push(route.request().url());
      return route.abort();
    },
  );
  const art = async (icon: ReturnType<typeof page.locator>) => {
    await expect(icon).toBeVisible();
    const image = icon.locator('img');
    await expect(image).toHaveAttribute('src', '/assets/geosptstruct-athena.webp');
    await expect
      .poll(() =>
        image.evaluate((img: HTMLImageElement) => [
          img.complete,
          img.naturalWidth,
          img.naturalHeight,
        ]),
      )
      .toEqual([true, 768, 768]);
    // Arte quadrada em caixa quadrada: sem deformação nem corte.
    const box = (await icon.boundingBox())!;
    const shown = (await image.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    expect(Math.abs(shown.width - box.width)).toBeLessThan(1);
    expect(Math.abs(shown.height - box.height)).toBeLessThan(1);
    return box.width;
  };
  for (const [theme, value] of [
    ['Claro', 'light'],
    ['Escuro', 'dark'],
  ]) {
    await page.setViewportSize({ width: 1320, height: 1000 });
    await page.getByRole('button', { name: 'Configurações', exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.getByRole('button', { name: 'Salvar configurações' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', value);
    await page.getByRole('button', { name: 'Todos os aplicativos', exact: false }).first().click();
    // Janela mínima do Tauri (880 × 650).
    await page.setViewportSize({ width: 880, height: 650 });
    await page
      .getByRole('textbox', { name: 'Buscar aplicativos por nome ou descrição' })
      .fill('GeoSPT');
    await page.getByRole('button', { name: 'Visualização em grade' }).click();
    const card = await art(page.locator('.product-card .product-icon'));
    await page.getByRole('button', { name: 'Visualização em lista' }).click();
    await expect(page.locator('.list-layout')).toBeVisible();
    await art(page.locator('.product-card .product-icon'));
    await page.getByRole('button', { name: 'GeoSPT', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'GeoSPT' });
    expect(await art(dialog.locator('.product-icon.large'))).toBeGreaterThan(card);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(external).toEqual([]);
});
