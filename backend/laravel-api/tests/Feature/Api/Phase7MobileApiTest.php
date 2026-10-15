<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase7MobileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_push_token_and_update_preferences(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/devices/push-tokens', ['token' => 'ExponentPushToken[test]', 'platform' => 'android'])->assertOk();
        $this->assertDatabaseHas('push_tokens', ['user_id' => $user->id, 'token' => 'ExponentPushToken[test]', 'platform' => 'android']);

        $this->putJson('/api/v1/notification-preferences', ['payment_updates' => false])->assertOk();
        $this->assertDatabaseHas('notification_preferences', ['user_id' => $user->id, 'payment_updates' => false]);

        $this->deleteJson('/api/v1/devices/push-tokens', ['token' => 'ExponentPushToken[test]'])->assertOk();
        $this->assertDatabaseMissing('push_tokens', ['token' => 'ExponentPushToken[test]']);
    }
}
