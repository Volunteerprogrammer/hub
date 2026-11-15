<?php
/**
 * Admin configuration for the Hub status endpoint.
 *
 * The admin password is never stored in plain text here — only its
 * bcrypt hash. To change the password, generate a new hash and paste
 * it in below:
 *
 *   C:\xampp\php\php.exe -r "echo password_hash('your-new-password', PASSWORD_DEFAULT), PHP_EOL;"
 *
 * Default password (change this before going live): WoodendHub2026
 */
return [
    'admin_password_hash' => '$2y$10$Fi.mpzAj2t9lcdu.1q1tme7/zUB8jSFRiVP3JZt84.xnnEsOaKtIC',
];
