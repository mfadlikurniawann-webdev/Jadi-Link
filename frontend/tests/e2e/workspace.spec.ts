import { expect, test } from '@playwright/test';
import { fixtureLink, LINK_ID, login, mockApi, TEST_TOKEN } from './mock-api';

test('register → create → copy → detail/chart → edit → toggle → delete', async ({
  page,
  context,
}) => {
  const state = await mockApi(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/register');
  await page
    .getByLabel('Alamat email', { exact: true })
    .fill('owner@example.com');
  await page
    .getByLabel('Kata sandi', { exact: true })
    .fill('browser-test-password-123');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Tautan pertamamu menunggu.')).toBeVisible();
  await page.getByRole('button', { name: 'Buat tautan', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('URL tujuan', { exact: true })
    .fill('https://example.com/new');
  await dialog.getByLabel('Alias', { exact: false }).fill('my-portfolio');
  await dialog
    .getByRole('button', { name: 'Buat tautan', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('link', { name: /s.example.com\/my-portfolio/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Salin my-portfolio', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('https://s.example.com/my-portfolio');
  await page.getByRole('link', { name: /s.example.com\/my-portfolio/ }).click();
  await expect(page.getByRole('heading', { name: 'Analitik' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Grafik klik harian/ }),
  ).toBeVisible();
  await page.getByText('Lihat data harian', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Klik harian dalam UTC' }).getByRole('row'),
  ).toHaveCount(31);
  await page.getByRole('button', { name: 'Edit tautan', exact: true }).click();
  await expect(dialog.getByLabel('Alias', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await dialog
    .getByLabel('URL tujuan', { exact: true })
    .fill('https://example.com/updated');
  await dialog.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'https://example.com/updated',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    state.writes.find((item) => item.method === 'PATCH')?.body,
  ).not.toHaveProperty('alias');
  await page.getByRole('switch', { name: 'Status aktif tautan' }).click();
  await expect(
    page.getByRole('switch', { name: 'Status aktif tautan' }),
  ).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Nonaktif', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus tautan', exact: true }).click();
  await dialog.getByRole('button', { name: 'Ya, hapus tautan' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Tautan pertamamu menunggu.')).toBeVisible();
});

test('keeps tokens out of storage and requires login after a refresh', async ({
  page,
}) => {
  await mockApi(page, [{ ...fixtureLink }]);
  await login(page);
  await expect(
    page.getByRole('link', { name: /s.example.com\/hello-world/ }),
  ).toBeVisible();
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookies: document.cookie,
    }),
  );
  expect(storage).not.toContain(TEST_TOKEN);
  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole('heading', { name: 'Masuk, lalu bagikan.' }),
  ).toBeVisible();
});

test('protects direct routes and blocks an external return URL', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(`/links/${LINK_ID}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto('/login?next=https%3A%2F%2Fevil.example');
  await page
    .getByLabel('Alamat email', { exact: true })
    .fill('owner@example.com');
  await page
    .getByLabel('Kata sandi', { exact: true })
    .fill('browser-test-password-123');
  await page.getByRole('button', { name: 'Masuk ke workspace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('expires an in-memory session and handles protected API 401', async ({
  page,
}) => {
  const state = await mockApi(page, [{ ...fixtureLink }]);
  await login(page);
  await expect(page.getByRole('link', { name: /hello-world/ })).toBeVisible();
  state.unauthorized = true;
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page).toHaveURL(/reason=expired/);
  await expect(
    page.getByText('Sesimu sudah berakhir. Silakan masuk lagi.'),
  ).toBeVisible();
});

test('signs out when the 15-minute timer ends', async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await login(page);
  await expect(page.getByText('Tautan pertamamu menunggu.')).toBeVisible();
  // Jump as after a suspended tab, without replaying 15 minutes of dev timers.
  await page.clock.fastForward(900001);
  await expect(page).toHaveURL(/reason=expired/);
});

test('shows login, API and rate-limit errors without exposing diagnostics', async ({
  page,
}) => {
  const state = await mockApi(page, [{ ...fixtureLink }]);
  state.authStatus = 401;
  await page.goto('/login');
  await page
    .getByLabel('Alamat email', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('Kata sandi', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Masuk ke workspace' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Email atau kata sandi tidak cocok.' }),
  ).toBeVisible();
  state.authStatus = 200;
  state.listStatus = 500;
  await page.getByRole('button', { name: 'Masuk ke workspace' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Server sedang mengalami kendala' }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('DB details');
  state.listStatus = 200;
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await page.getByRole('link', { name: /s.example.com\/hello-world/ }).click();
  state.analyticsStatus = 429;
  await page.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '6 detik' }),
  ).toBeVisible();
});

test('paginates and makes it clear search applies to the current page only', async ({
  page,
}) => {
  const links = Array.from({ length: 21 }, (_, index) => ({
    ...fixtureLink,
    id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
    code: `link-${index}`,
    shortUrl: `https://s.example.com/link-${index}`,
  }));
  await mockApi(page, links);
  await login(page);
  await expect(
    page.getByText('20 tautan ditampilkan · halaman 1'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await expect(
    page.getByText('1 tautan ditampilkan · halaman 2'),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Cari di halaman ini' })
    .fill('missing');
  await expect(page.getByText('Belum ada yang cocok.')).toBeVisible();
});

test('handles a missing detail and supports logout', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.goto(`/links/${LINK_ID}`);
  // A full document navigation clears the intentionally memory-only session.
  await expect(page).toHaveURL(/\/login/);
  await page
    .getByLabel('Alamat email', { exact: true })
    .fill('owner@example.com');
  await page
    .getByLabel('Kata sandi', { exact: true })
    .fill('browser-test-password-123');
  await page.getByRole('button', { name: 'Masuk ke workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tautan tidak ditemukan.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Keluar', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login/);
});

test('fits a mobile screen and allows dismissing a keyboard-focused dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, [{ ...fixtureLink }]);
  await login(page, 'long-workspace-owner-12345678901234567890@example.com');
  await expect(
    page.getByRole('link', { name: /s.example.com\/hello-world/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const reload = await page
    .getByRole('button', { name: 'Muat ulang', exact: true })
    .boundingBox();
  expect(reload).not.toBeNull();
  expect(reload!.x + reload!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Buat tautan', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Buat tautan', exact: true }),
  ).toBeFocused();
});
