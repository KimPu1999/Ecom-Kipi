<?php

namespace Tests\Feature\Api;

use App\Exceptions\InvalidGoogleIdentityException;
use App\Exceptions\UnverifiedGoogleEmailException;
use App\Models\Role;
use App\Models\User;
use App\Services\GoogleIdentityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_verified_google_identity_creates_a_customer_and_returns_a_sanctum_token(): void
    {
        config(['services.google.client_id' => 'google-client-id']);
        $this->fakeGoogleIdentity();

        $response = $this->postJson('/api/v1/auth/google', ['credential' => 'verified-google-token']);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.email', 'google@example.com')
            ->assertJsonPath('data.user.roles.0', 'customer')
            ->assertJsonPath('data.token_type', 'Bearer');

        $user = User::query()->where('email', 'google@example.com')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue($user->hasRole('customer'));
        $this->assertDatabaseCount('users', 1);
    }

    public function test_google_identity_uses_the_existing_customer_account_without_creating_a_duplicate(): void
    {
        config(['services.google.client_id' => 'google-client-id']);
        $user = User::factory()->unverified()->create(['email' => 'Google@Example.com']);
        $user->roles()->attach(Role::query()->create(['name' => 'customer', 'label' => 'Customer']));
        $this->fakeGoogleIdentity('google@example.com');

        $this->postJson('/api/v1/auth/google', ['credential' => 'verified-google-token'])
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id);

        $this->assertDatabaseCount('users', 1);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_google_sign_in_cannot_be_used_for_staff_accounts(): void
    {
        config(['services.google.client_id' => 'google-client-id']);
        $user = User::factory()->create(['email' => 'staff@example.com']);
        $user->roles()->attach(Role::query()->create(['name' => 'admin', 'label' => 'Administrator']));
        $this->fakeGoogleIdentity('staff@example.com');

        $this->postJson('/api/v1/auth/google', ['credential' => 'verified-google-token'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Use the staff sign-in for this account.');
    }

    public function test_invalid_google_identity_is_rejected(): void
    {
        config(['services.google.client_id' => 'google-client-id']);
        $this->app->instance(GoogleIdentityService::class, new class extends GoogleIdentityService
        {
            public function configured(): bool
            {
                return true;
            }

            public function verify(string $credential): array
            {
                throw new InvalidGoogleIdentityException('invalid');
            }
        });

        $this->postJson('/api/v1/auth/google', ['credential' => 'invalid-token'])
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Google sign-in could not be verified. Please try again.');
    }

    public function test_unverified_google_email_is_rejected_with_a_clear_message(): void
    {
        config(['services.google.client_id' => 'google-client-id']);
        $this->app->instance(GoogleIdentityService::class, new class extends GoogleIdentityService
        {
            public function configured(): bool
            {
                return true;
            }

            public function verify(string $credential): array
            {
                throw new UnverifiedGoogleEmailException('unverified');
            }
        });

        $this->postJson('/api/v1/auth/google', ['credential' => 'unverified-token'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Verify your Google email address before signing in.');
    }

    private function fakeGoogleIdentity(string $email = 'google@example.com'): void
    {
        $this->app->instance(GoogleIdentityService::class, new class($email) extends GoogleIdentityService
        {
            public function __construct(private readonly string $email) {}

            public function configured(): bool
            {
                return true;
            }

            public function verify(string $credential): array
            {
                return [
                    'subject' => 'google-subject',
                    'email' => $this->email,
                    'name' => 'Google Customer',
                ];
            }
        });
    }
}
