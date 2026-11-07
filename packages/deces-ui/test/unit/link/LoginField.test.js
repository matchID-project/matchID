import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LoginField from '../../../src/components/views/LoginField.svelte';
import { accessToken, accessTokenInfos, user } from '../../../src/components/tools/stores.js';
import { resetLinkStores, stubFetch, jsonResponse, flush } from './helpers.js';

const email = () => document.querySelector('input#email');
const otp = () => document.querySelector('input#emailOTP');
const text = () => document.body.textContent.replace(/\s+/g, ' ');
const registerCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => url === '/deces/api/v1/register');
const authCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => url === '/deces/api/v1/auth');

const typeEmail = async (value) => {
  await fireEvent.focus(email());
  await fireEvent.input(email(), { target: { value } });
};
const submitEmail = async (value) => {
  await typeEmail(value);
  await fireEvent.submit(email().closest('form'));
  await flush();
};

describe('LoginField (inline email OTP login on /link)', () => {
  beforeEach(() => resetLinkStores());

  it('LK-179 shows the hint "Un code d\'accès sera envoyé à cette adresse…"', () => {
    render(LoginField, { button: true });
    expect(document.querySelector('label[for="email"]').textContent.trim()).toBe('Courriel');
    expect(text()).toContain('Un code d\'accès sera envoyé à cette adresse pour valider votre identité');
  });

  it('LK-180 submitting the email (send button) POSTs /register', async () => {
    const fetchMock = stubFetch({ 'POST /deces/api/v1/register': { valid: true, msg: 'ok' } });
    render(LoginField, { button: true });
    const button = screen.getByTitle('Valider le courriel');
    expect(button.type).toBe('submit');
    await typeEmail('bob@example.org');
    await fireEvent.click(button);
    await flush();
    expect(registerCalls(fetchMock)).toHaveLength(1);
    expect(registerCalls(fetchMock)[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ user: 'bob@example.org' }) });
  });

  it('LK-180 the button mode does not register on blur', async () => {
    const fetchMock = stubFetch();
    render(LoginField, { button: true });
    await typeEmail('bob@example.org');
    await fireEvent.blur(email());
    expect(registerCalls(fetchMock)).toHaveLength(0);
  });

  it('LK-181 non-button mode: blur triggers the registration', async () => {
    const fetchMock = stubFetch({ 'POST /deces/api/v1/register': { valid: true, msg: 'ok' } });
    render(LoginField);
    expect(screen.queryByTitle('Valider le courriel')).toBeNull();
    await typeEmail('bob@example.org');
    await fireEvent.blur(email());
    expect(registerCalls(fetchMock)).toHaveLength(1);
  });

  it('LK-182 an invalid format shows "Format email invalide" without calling the backend', async () => {
    const fetchMock = stubFetch();
    render(LoginField, { button: true });
    await submitEmail('bob@');
    expect(document.querySelector('p.rf-error-text').textContent.trim()).toBe('Format email invalide');
    expect(registerCalls(fetchMock)).toHaveLength(0);
  });

  it('LK-183 a failed registration (valid:false) shows the backend message in red and stays on the email stage', async () => {
    stubFetch({ 'POST /deces/api/v1/register': () => jsonResponse({ valid: false, msg: 'Coudn\'t send mail' }, 422) });
    render(LoginField, { button: true });
    await submitEmail('bob@example.org');
    await waitFor(() => expect(document.querySelector('p.rf-error-text').textContent.trim()).toBe('Coudn\'t send mail'));
    expect(email().closest('.rf-input-group').classList.contains('rf-input-group--error')).toBe(true);
    expect(otp()).toBeNull();
  });

  it('LK-184 a successful registration switches to the OTP stage "Code de validation" with its hint', async () => {
    stubFetch({ 'POST /deces/api/v1/register': { valid: true, msg: 'code sent' } });
    render(LoginField, { button: true });
    await submitEmail('bob@example.org');
    await waitFor(() => expect(otp()).not.toBeNull());
    expect(document.querySelector('label[for="emailOTP"]').textContent.trim()).toBe('Code de validation');
    expect(text()).toContain('Un code vous a été envoyé à l\'adresse indiquée pour valider votre identité');
    expect(email()).toBeNull();
    expect(screen.getByTitle('Valider pour s\'identifier').type).toBe('submit');
  });

  const toOtpStage = async (routes = {}, props = { button: true }) => {
    const fetchMock = stubFetch({ 'POST /deces/api/v1/register': { valid: true, msg: 'code sent' }, ...routes });
    render(LoginField, props);
    await typeEmail('bob@example.org');
    if (props.button) {
      await fireEvent.submit(email().closest('form'));
    } else {
      await fireEvent.blur(email());
    }
    await waitFor(() => expect(otp()).not.toBeNull());
    return fetchMock;
  };

  it('LK-185 the OTP input keeps digits only, 6 max', async () => {
    await toOtpStage();
    expect(otp().getAttribute('maxlength')).toBe('6');
    await fireEvent.input(otp(), { target: { value: '12ab34' } });
    expect(otp().value).toBe('1234');
  });

  it('LK-186 submitting the OTP POSTs /auth and stores the token and the user (not accessTokenInfos)', async () => {
    const fetchMock = await toOtpStage({ 'POST /deces/api/v1/auth': { access_token: 'jwt-otp', created_at: '1' } });
    await fireEvent.input(otp(), { target: { value: '123456' } });
    await fireEvent.click(screen.getByTitle('Valider pour s\'identifier'));
    await waitFor(() => expect(get(accessToken)).toBe('jwt-otp'));
    expect(authCalls(fetchMock)[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ user: 'bob@example.org', password: '123456' }) });
    expect(get(user)).toBe('bob@example.org');
    expect(get(accessTokenInfos)).toEqual({});
  });

  it('LK-186 an incomplete code is not submitted', async () => {
    const fetchMock = await toOtpStage();
    await fireEvent.input(otp(), { target: { value: '123' } });
    await fireEvent.submit(otp().closest('form'));
    expect(authCalls(fetchMock)).toHaveLength(0);
  });

  it('LK-187 non-button mode: auto-login on the 6th digit', async () => {
    const fetchMock = await toOtpStage({ 'POST /deces/api/v1/auth': { access_token: 'jwt-auto' } }, {});
    await fireEvent.input(otp(), { target: { value: '12345' } });
    expect(authCalls(fetchMock)).toHaveLength(0);
    await fireEvent.input(otp(), { target: { value: '123456' } });
    await waitFor(() => expect(get(accessToken)).toBe('jwt-auto'));
  });

  it('LK-187 non-button mode: blur on the OTP triggers the login', async () => {
    const fetchMock = await toOtpStage({ 'POST /deces/api/v1/auth': () => jsonResponse({ msg: 'invalid' }, 401) }, {});
    await fireEvent.input(otp(), { target: { value: '654321' } });
    await flush();
    expect(authCalls(fetchMock)).toHaveLength(1);
    await fireEvent.blur(otp());
    expect(authCalls(fetchMock)).toHaveLength(2);
  });

  it('LK-188 a wrong OTP (401) shows "Le code d\'accès n\'est pas valide / Veuillez réessayer"', async () => {
    await toOtpStage({ 'POST /deces/api/v1/auth': () => jsonResponse({ msg: 'invalid' }, 401) });
    await fireEvent.input(otp(), { target: { value: '000000' } });
    await fireEvent.submit(otp().closest('form'));
    await waitFor(() => expect(text()).toContain('Le code d\'accès n\'est pas valide Veuillez réessayer'));
    expect(otp().closest('.rf-input-group').classList.contains('rf-input-group--error')).toBe(true);
    expect(get(user)).toBeUndefined();
    expect(get(accessToken)).toBeUndefined();
  });

  it('LK-189 focus clears the email (stage 1) and the code (stage 2)', async () => {
    stubFetch({ 'POST /deces/api/v1/register': { valid: true, msg: 'code sent' } });
    render(LoginField, { button: true });
    await fireEvent.input(email(), { target: { value: 'bob@' } });
    await fireEvent.submit(email().closest('form'));
    expect(text()).toContain('Format email invalide');
    await fireEvent.focus(email());
    expect(email().value).toBe('');
    expect(text()).not.toContain('Format email invalide');
    await fireEvent.input(email(), { target: { value: 'bob@example.org' } });
    await fireEvent.submit(email().closest('form'));
    await waitFor(() => expect(otp()).not.toBeNull());
    await fireEvent.input(otp(), { target: { value: '12' } });
    await fireEvent.focus(otp());
    expect(otp().value).toBe('');
  });

  it('LK-190 logged in: email disabled and prefilled, "Vous êtes identifié(e)", no buttons', async () => {
    user.set('bob@example.org');
    render(LoginField, { button: true });
    await flush();
    expect(email().disabled).toBe(true);
    expect(email().value).toBe('bob@example.org');
    expect(document.querySelector('p.rf-valid-text').textContent.trim()).toBe('Vous êtes identifié(e)');
    expect(document.querySelector('button')).toBeNull();
  });
});
