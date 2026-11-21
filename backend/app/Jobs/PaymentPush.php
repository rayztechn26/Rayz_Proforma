<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PaymentPush implements ShouldQueue
{
    use Queueable;

    public $tries = 4;

    public function backoff(): array
    {
        return [30, 120, 600];
    }

    public function handle(): void
    {
        if (! config('licensing.push_public') || ! config('licensing.push_private') || ! config('licensing.push_subject')) {
            return;
        }$push = new WebPush(['VAPID' => ['subject' => config('licensing.push_subject'), 'publicKey' => config('licensing.push_public'), 'privateKey' => config('licensing.push_private')]]);
        foreach (DB::table('push_subscriptions')->join('users', 'users.id', '=', 'push_subscriptions.user_id')->where('is_admin', true)->select('push_subscriptions.*')->get() as $s) {
            $push->queueNotification(Subscription::create(json_decode(decrypt($s->subscription), true)), json_encode(['title' => 'Rayz Proforma', 'body' => 'A payment request needs review.', 'url' => '/admin']));
        }$retry = false;
        foreach ($push->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                DB::table('push_subscriptions')->where('endpoint_hash', hash('sha256', $report->getEndpoint()))->delete();
            } elseif (! $report->isSuccess()) {
                $retry = true;
            }
        }if ($retry) {
            throw new \RuntimeException('Push delivery failed; notification centre remains available.');
        }
    }

    public function failed(?\Throwable $e): void
    {
        \Log::warning('Admin push delivery exhausted retries; use notification centre.');
    }
}
