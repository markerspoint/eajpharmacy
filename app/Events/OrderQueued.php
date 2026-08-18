<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderQueued implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $order;
    public int $branchId;

    public function __construct(array $order, int $branchId)
    {
        $this->order = $order;
        $this->branchId = $branchId;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'OrderQueued';
    }

    public function broadcastWith(): array
    {
        return [
            'order' => $this->order,
        ];
    }
}
