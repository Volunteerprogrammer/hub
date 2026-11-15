<?php
/**
 * Hub status API.
 *
 * GET  -> returns the current status as JSON:
 *         { "status": "...", "event": { "bushfire": bool, "storm": bool, "heatwave": bool }, "updatedAt": "..." }
 * POST -> sets the status and event flags (requires the admin password). Body: JSON
 *         { "password": "...", "status": "NOW OPEN" | "CLOSED",
 *           "event": { "bushfire": bool, "storm": bool, "heatwave": bool } }
 *
 * "event" records which emergency type(s) triggered the Hub opening —
 * more than one can be true at once (e.g. a bushfire during a
 * heatwave). It's stored regardless of status, so the admin's
 * selections persist between visits to the panel, but the front-end
 * only treats it as meaningful while status is "NOW OPEN".
 *
 * Status is persisted to a flat JSON file (../data/status.json) — no
 * database required. The front-end polls this endpoint so that every
 * open browser tab picks up a change within a few seconds.
 *
 * The admin password is checked (with per-IP rate limiting) by
 * verify_admin_password() in auth.php, shared with the other
 * admin-writable endpoints.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/auth.php';

const VALID_STATUSES = ['NOW OPEN', 'CLOSED'];
const EVENT_KEYS = ['bushfire', 'storm', 'heatwave'];

$dataFile = __DIR__ . '/../data/status.json';

function empty_event(): array
{
    return ['bushfire' => false, 'storm' => false, 'heatwave' => false];
}

function normalize_event($rawEvent): array
{
    $event = empty_event();
    if (is_array($rawEvent)) {
        foreach (EVENT_KEYS as $k) {
            $event[$k] = !empty($rawEvent[$k]);
        }
    }
    return $event;
}

function default_status(): array
{
    return ['status' => 'CLOSED', 'event' => empty_event(), 'updatedAt' => gmdate('c')];
}

function read_status(string $file): array
{
    if (!file_exists($file)) {
        return default_status();
    }

    $raw  = file_get_contents($file);
    $data = json_decode((string) $raw, true);

    if (!is_array($data) || !isset($data['status']) || !in_array($data['status'], VALID_STATUSES, true)) {
        return default_status();
    }

    $data['event'] = normalize_event($data['event'] ?? null);

    return $data;
}

function write_status(string $file, string $status, array $event): array
{
    $data = ['status' => $status, 'event' => $event, 'updatedAt' => gmdate('c')];
    $tmp  = $file . '.tmp';

    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $file);

    return $data;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode(read_status($dataFile));
    exit;
}

if ($method === 'POST') {
    $body     = json_decode((string) file_get_contents('php://input'), true);
    $password = is_array($body) ? ($body['password'] ?? '') : '';
    $status   = is_array($body) ? ($body['status'] ?? '') : '';
    $event    = normalize_event(is_array($body) ? ($body['event'] ?? null) : null);

    if (!in_array($status, VALID_STATUSES, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status value.']);
        exit;
    }

    $auth = verify_admin_password(is_string($password) ? $password : '');
    if (!$auth['ok']) {
        http_response_code($auth['httpCode']);
        if (isset($auth['retryAfter'])) {
            header('Retry-After: ' . $auth['retryAfter']);
        }
        echo json_encode(['error' => $auth['error']]);
        exit;
    }

    echo json_encode(write_status($dataFile, $status, $event));
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['error' => 'Method not allowed.']);
