<?php
/**
 * Shared admin-password verification, with per-IP rate limiting, used
 * by every endpoint that lets the admin panel write data (status,
 * location, ...). Keeping this in one place means a lockout earned on
 * one endpoint also applies to the others, instead of an attacker
 * being able to reset their attempt count just by switching targets.
 */

declare(strict_types=1);

const MAX_ATTEMPTS    = 5;   // failures allowed (per IP) before locking out
const ATTEMPT_WINDOW  = 600; // seconds — failures older than this don't count
const LOCKOUT_SECONDS = 900; // how long an IP is locked out once over the limit

function admin_config(): array
{
    return require_once __DIR__ . '/config.php';
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/**
 * Runs $callback with the login-attempts file open and exclusively
 * locked, so concurrent requests can't race each other reading and
 * writing it. $callback receives the decoded attempts array (keyed by
 * IP) and must return the (possibly modified) array to save.
 */
function with_attempts_file(callable $callback)
{
    $file   = __DIR__ . '/../data/login_attempts.json';
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        // If the file can't be opened for some reason, fail open rather
        // than blocking every admin login — but still run the callback
        // against an empty attempts set so the response logic works.
        return $callback([]);
    }

    flock($handle, LOCK_EX);

    $raw  = stream_get_contents($handle);
    $data = json_decode((string) $raw, true);
    if (!is_array($data)) {
        $data = [];
    }

    $now = time();

    // Drop stale entries (not locked, and no recent failures) so the
    // file doesn't grow unbounded from one-off scanners/bots.
    foreach ($data as $ip => $record) {
        $lockedUntil = $record['lockedUntil'] ?? null;
        $lastFailAt  = $record['lastFailAt'] ?? 0;
        if (($lockedUntil === null || $now >= $lockedUntil) && ($now - $lastFailAt) > ATTEMPT_WINDOW) {
            unset($data[$ip]);
        }
    }

    $result = $callback($data);

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($result, JSON_PRETTY_PRINT));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    return $result;
}

/**
 * Verifies the admin password against the shared per-IP rate limit.
 *
 * Returns ['ok' => true] on success (and clears this IP's failure
 * history), or ['ok' => false, 'httpCode' => int, 'error' => string,
 * 'retryAfter'?: int] on failure.
 */
function verify_admin_password(string $password): array
{
    $ip  = client_ip();
    $now = time();

    $lockedSecondsLeft = 0;
    with_attempts_file(function (array $data) use ($ip, $now, &$lockedSecondsLeft) {
        $lockedUntil = $data[$ip]['lockedUntil'] ?? null;
        if ($lockedUntil !== null && $now < $lockedUntil) {
            $lockedSecondsLeft = $lockedUntil - $now;
        }
        return $data; // no change yet
    });

    if ($lockedSecondsLeft > 0) {
        $waitMinutes = (int) ceil($lockedSecondsLeft / 60);
        return [
            'ok'         => false,
            'httpCode'   => 429,
            'retryAfter' => $lockedSecondsLeft,
            'error'      => "Too many incorrect attempts. Try again in about {$waitMinutes} minute" . ($waitMinutes === 1 ? '' : 's') . '.',
        ];
    }

    $config     = admin_config();
    $passwordOk = $password !== '' && password_verify($password, $config['admin_password_hash']);

    if (!$passwordOk) {
        usleep(300000); // small delay in addition to the lockout below

        $justLocked = false;
        with_attempts_file(function (array $data) use ($ip, $now, &$justLocked) {
            $record = $data[$ip] ?? ['count' => 0, 'firstFailAt' => $now, 'lockedUntil' => null];

            if (($now - $record['firstFailAt']) > ATTEMPT_WINDOW) {
                $record = ['count' => 0, 'firstFailAt' => $now, 'lockedUntil' => null];
            }

            $record['count']++;
            $record['lastFailAt'] = $now;

            if ($record['count'] >= MAX_ATTEMPTS) {
                $record['lockedUntil'] = $now + LOCKOUT_SECONDS;
                $justLocked = true;
            }

            $data[$ip] = $record;
            return $data;
        });

        return [
            'ok'       => false,
            'httpCode' => 401,
            'error'    => $justLocked
                ? 'Too many incorrect attempts. Locked out for 15 minutes.'
                : 'Incorrect password.',
        ];
    }

    // Correct password — clear any history for this IP.
    with_attempts_file(function (array $data) use ($ip) {
        unset($data[$ip]);
        return $data;
    });

    return ['ok' => true];
}
