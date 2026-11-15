<?php
/**
 * Admin password verification (no write).
 *
 * POST -> { "password": "..." }
 * Returns { "ok": true } if correct, or the usual rate-limited error
 * otherwise. Used by the admin panel to unlock its controls before
 * letting the admin touch the status/location buttons, so a wrong (or
 * empty) password doesn't need an actual write attempt to be caught.
 *
 * Shares the same per-IP lockout as status.php/location.php via
 * verify_admin_password() in auth.php — a failed attempt here counts
 * the same as a failed attempt anywhere else.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$body     = json_decode((string) file_get_contents('php://input'), true);
$password = is_array($body) ? ($body['password'] ?? '') : '';

$auth = verify_admin_password(is_string($password) ? $password : '');

if (!$auth['ok']) {
    http_response_code($auth['httpCode']);
    if (isset($auth['retryAfter'])) {
        header('Retry-After: ' . $auth['retryAfter']);
    }
    echo json_encode(['error' => $auth['error']]);
    exit;
}

echo json_encode(['ok' => true]);
