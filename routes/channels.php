<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('branch.{branchId}', function ($user, $branchId) {
    if ($user->isSuperAdmin()) {
        return true;
    }

    return (int) $user->branch_id === (int) $branchId;
});
