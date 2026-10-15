<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\NotificationPreferencesRequest;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function preferences(Request $request)
    {
        $preferences = $request->user()->notificationPreferences()->firstOrCreate([]);

        return ApiResponse::success($preferences, 'Notification preferences retrieved');
    }

    public function updatePreferences(NotificationPreferencesRequest $request)
    {
        $preferences = $request->user()->notificationPreferences()->updateOrCreate([], $request->validated());

        return ApiResponse::success($preferences, 'Notification preferences updated');
    }

    public function index(Request $request)
    {
        $notifications = $request->user()->notifications()->latest()->paginate(20);

        return ApiResponse::paginated($notifications, $notifications->items(), 'Notifications retrieved');
    }

    public function read(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->whereKey($id)->firstOrFail();
        $notification->markAsRead();

        return ApiResponse::success($notification, 'Notification marked as read');
    }

    public function readAll(Request $request)
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return ApiResponse::success(null, 'Notifications marked as read');
    }
}
