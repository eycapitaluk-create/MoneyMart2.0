import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import adminAuthHandler from '../api/admin-auth.js'
import basicAuthHandler from '../api/admin/basic-auth.js'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv(name) {
  if (ORIGINAL_ENV[name] === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = ORIGINAL_ENV[name]
  }
}

afterEach(() => {
  restoreEnv('ADMIN_BASIC_USER')
  restoreEnv('ADMIN_BASIC_PASS')
  restoreEnv('ALLOWED_ADMIN_IPS')
  restoreEnv('NODE_ENV')
})

function setAdminEnv() {
  process.env.ADMIN_BASIC_USER = 'admin'
  process.env.ADMIN_BASIC_PASS = 'secret'
  delete process.env.ALLOWED_ADMIN_IPS
  process.env.NODE_ENV = 'test'
}

function basicCredentials(value) {
  return `Basic ${Buffer.from(value).toString('base64')}`
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(value) {
      this.body = value
      return this
    },
    end(value) {
      this.body = value
      return this
    },
  }
}

test('admin basic-auth does not accept forged cookie substrings', () => {
  setAdminEnv()
  const res = createRes()

  basicAuthHandler({ headers: { cookie: 'other=mm_admin_basic=1' }, query: { next: '/admin' } }, res)

  assert.equal(res.statusCode, 401)
  assert.equal(res.headers['set-cookie'], undefined)
})

test('admin basic-auth accepts only exact admin session cookie', () => {
  setAdminEnv()
  const res = createRes()

  basicAuthHandler({ headers: { cookie: 'other=1; mm_admin_basic=1' }, query: { next: '/admin/news' } }, res)

  assert.equal(res.statusCode, 302)
  assert.match(res.headers['set-cookie'], /^mm_admin_basic=1;/)
  assert.equal(res.headers.location, '/admin/news')
})

test('admin-auth fails closed when the admin password env is missing', () => {
  setAdminEnv()
  delete process.env.ADMIN_BASIC_PASS
  const res = createRes()

  adminAuthHandler({ headers: { authorization: basicCredentials('admin') } }, res)

  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, {
    ok: false,
    error: 'ADMIN_BASIC_USER / ADMIN_BASIC_PASS is required',
  })
})

test('admin-auth accepts configured credentials', () => {
  setAdminEnv()
  const res = createRes()

  adminAuthHandler({ headers: { authorization: basicCredentials('admin:secret') } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
})

test('admin auth endpoints enforce configured IP allowlist', () => {
  setAdminEnv()
  process.env.ALLOWED_ADMIN_IPS = '203.0.113.10'
  const res = createRes()

  adminAuthHandler({
    headers: {
      authorization: basicCredentials('admin:secret'),
      'x-forwarded-for': '198.51.100.2',
    },
  }, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.body, { ok: false, error: 'Access denied', ip: '198.51.100.2' })
})
