<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderProcessed implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $orderId;
    public int $branchId;
    public string $reason;
    public ?int $processedBy;

    public function __construct(int $orderId, int $branchId, string $reason = 'paid', ?int $processedBy = null)
    {
        $this->orderId = $orderId;
        $this->branchId = $branchId;
        $this->reason = $reason;
        $this->processedBy = $processedBy;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'OrderProcessed';
    }

    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->orderId,
            'reason' => $this->reason,
            'processed_by' => $this->processedBy,
        ];
    }
}
