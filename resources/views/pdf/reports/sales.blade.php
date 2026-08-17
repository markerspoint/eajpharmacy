<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sales Report - {{ now()->format('Y-m-d') }}</title>
    <style>
        @page { margin: 25px; }
        body { 
            font-family: DejaVu Sans, Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
            font-size: 13px; 
            color: #1f2937;
        }
        .header { 
            text-align: center; 
            margin-bottom: 20px; 
            padding-bottom: 15px; 
            border-bottom: 3px solid #4f46e5; 
        }
        .title { 
            font-size: 20px; 
            font-weight: bold; 
            color: #1e3a8a; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0; 
        }
        th, td { 
            padding: 8px 10px; 
            border: 1px solid #e5e7eb; 
            text-align: left; 
        }
        th { 
            background-color: #f8fafc; 
            font-weight: 600; 
        }
        .amount { 
            text-align: right; 
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace; 
        }
        .section-title { 
            font-size: 15px; 
            font-weight: 600; 
            margin: 20px 0 8px; 
            color: #374151; 
        }
        .total-row td { 
            font-weight: bold; 
            background-color: #f0fdf4; 
            border-top: 2px solid #4f46e5; 
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="title">{{ $branch->name ?? '' }} Sales Report</div>
        {{-- <p style="margin: 5px 0 0; font-size: 14px;">Sales Report</p> --}}
        <p style="margin: 3px 0 0;">
            @if(isset($from_date) && isset($to_date))
                {{ \Carbon\Carbon::parse($from_date)->format('M d, Y') }} — {{ \Carbon\Carbon::parse($to_date)->format('M d, Y') }}
            @else
                {{ now()->format('F d, Y') }}
            @endif
        </p>
    </div>

    <div class="section-title">Sales Transactions</div>
    <table>
        <tr>
            <th>Receipt #</th>
            <th>Date</th>
            <th>Created By</th>
            <th>Payment By</th>
            <th>Customer</th>
            <th class="amount">Total</th>
            <th class="amount">Discount</th>
            <th class="amount">Payment</th>
        </tr>
        @foreach($sales as $sale)
        <tr>
            <td>{{ $sale->receipt_number }}</td>
            <td>{{ \Carbon\Carbon::parse($sale->created_at)->format('M d, Y h:i A') }}</td>
            <td>{{ $sale->orderCreator->full_name ?? $sale->user->full_name ?? '—' }}</td>
            <td>{{ $sale->paymentReceiver->full_name ?? $sale->user->full_name ?? '—' }}</td>
            <td>{{ $sale->customer_name ?? 'Walk-in' }}</td>
            <td class="amount">₱{{ number_format($sale->total, 2) }}</td>
            <td class="amount">{{ $sale->discount_amount > 0 ? '-₱' . number_format($sale->discount_amount, 2) : '—' }}</td>
            <td class="amount">{{ strtoupper($sale->payment_method) }}</td>
        </tr>
        @endforeach

        <tr class="total-row">
            <td colspan="5" style="text-align: right;">TOTAL SALES</td>
            <td class="amount" style="font-size: 15px;">₱{{ number_format($total_sales ?? 0, 2) }}</td>
            <td colspan="2"></td>
        </tr>
    </table>

    <div style="margin-top: 35px; text-align: center; font-size: 11px; color: #6b7280;">
        Generated on {{ now()->format('Y-m-d H:i:s') }}
    </div>

</body>
</html>
