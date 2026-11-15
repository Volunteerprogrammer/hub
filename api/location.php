<?php
/**
 * Hub location API.
 *
 * GET  -> returns the current location as JSON:
 *         { "venue": "...", "address": "...", "updatedAt": "..." }
 * POST -> sets the location (requires the admin password). Body: JSON
 *         { "password": "...", "venue": "...", "address": "..." }
 *
 * Location is persisted to a flat JSON file (../data/location.json),
 * same approach as status.php. The "Where is it?" page fetches this on
 * load and polls it, so a location change made via the admin panel
 * appears on every open page within a few seconds — e.g. if the Hub
 * has to relocate away from the Neighbourhood House for safety reasons.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/auth.php';

const MAX_FIELD_LENGTH = 200;

$dataFile = __DIR__ . '/../data/location.json';

function default_location(): array
{
    return [
        'venue'     => 'Woodend Neighbourhood House',
        'address'   => '47 Forest Street, Woodend',
        'updatedAt' => gmdate('c'),
    ];
}

function read_location(string $file): array
{
    if (!file_exists($file)) {
        return default_location();
    }

    $raw  = file_get_contents($file);
    $data = json_decode((string) $raw, true);

    if (!is_array($data) || !isset($data['venue'], $data['address'])) {
        return default_location();
    }

    return $data;
}

function write_location(string $file, string $venue, string $address): array
{
    $data = ['venue' => $venue, 'address' => $address, 'updatedAt' => gmdate('c')];
    $tmp  = $file . '.tmp';

    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $file);

    return $data;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode(read_location($dataFile));
    exit;
}

if ($method === 'POST') {
    $body     = json_decode((string) file_get_contents('php://input'), true);
    $password = is_array($body) ? ($body['password'] ?? '') : '';
    $venue    = is_array($body) ? trim((string) ($body['venue'] ?? '')) : '';
    $address  = is_array($body) ? trim((string) ($body['address'] ?? '')) : '';

    if ($venue === '' || $address === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Venue and address are both required.']);
        exit;
    }

    if (mb_strlen($venue) > MAX_FIELD_LENGTH || mb_strlen($address) > MAX_FIELD_LENGTH) {
        http_response_code(400);
        echo json_encode(['error' => 'Venue/address is too long.']);
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

    echo json_encode(write_location($dataFile, $venue, $address));
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['error' => 'Method not allowed.']);
