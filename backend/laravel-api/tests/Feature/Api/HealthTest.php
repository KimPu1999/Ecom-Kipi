<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_endpoint_returns_a_public_status(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'healthy')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');
    }

    public function test_readiness_endpoint_returns_only_safe_dependency_statuses(): void
    {
        $response = $this->getJson('/api/v1/health/ready');

        $this->assertContains($response->status(), [200, 503]);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'service',
                'status',
                'checks' => ['database', 'redis'],
            ],
        ]);
        $this->assertStringNotContainsString('password', $response->getContent());
    }
}
