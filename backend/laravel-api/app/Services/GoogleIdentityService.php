<?php

namespace App\Services;

use App\Exceptions\InvalidGoogleIdentityException;
use App\Exceptions\UnverifiedGoogleEmailException;
use Google\Client as GoogleClient;
use Illuminate\Support\Str;
use Throwable;

class GoogleIdentityService
{
    public function __construct(private readonly ?string $clientId = null) {}

    public function configured(): bool
    {
        return filled($this->clientId ?? config('services.google.client_id'));
    }

    /**
     * @return array{subject: string, email: string, name: string}
     */
    public function verify(string $credential): array
    {
        $clientId = $this->clientId ?? config('services.google.client_id');

        if (! filled($clientId)) {
            throw new InvalidGoogleIdentityException('Google sign-in is not configured.');
        }

        try {
            $payload = (new GoogleClient(['client_id' => $clientId]))->verifyIdToken($credential);
        } catch (Throwable $exception) {
            throw new InvalidGoogleIdentityException('Google identity verification failed.', 0, $exception);
        }

        if (! is_array($payload)) {
            throw new InvalidGoogleIdentityException('Google identity verification failed.');
        }

        $issuer = (string) ($payload['iss'] ?? '');
        $audience = (string) ($payload['aud'] ?? '');
        $expiresAt = $payload['exp'] ?? null;
        $email = Str::lower(trim((string) ($payload['email'] ?? '')));
        $emailVerified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $subject = trim((string) ($payload['sub'] ?? ''));

        if (! in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)
            || ! hash_equals((string) $clientId, $audience)
            || ! is_numeric($expiresAt)
            || (int) $expiresAt <= now()->timestamp
            || $subject === ''
            || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidGoogleIdentityException('Google identity verification failed.');
        }

        if (! $emailVerified) {
            throw new UnverifiedGoogleEmailException('Google email address is not verified.');
        }

        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            $name = Str::before($email, '@');
        }

        return [
            'subject' => $subject,
            'email' => $email,
            'name' => mb_substr($name, 0, 120),
        ];
    }
}
