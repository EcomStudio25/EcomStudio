'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface CreditUsageStatsProps {
  supabase: SupabaseClient;
}

interface PeriodStat {
  amount: number;
  change: number; // percentage change
  changeType: 'positive' | 'negative' | 'neutral';
}

interface CreditStats {
  spend: {
    daily: PeriodStat;
    weekly: PeriodStat;
    monthly: PeriodStat;
    quarterly: PeriodStat;
    yearly: PeriodStat;
  };
  topup: {
    daily: PeriodStat;
    weekly: PeriodStat;
    monthly: PeriodStat;
    quarterly: PeriodStat;
    yearly: PeriodStat;
  };
}

export default function CreditUsageStats({ supabase }: CreditUsageStatsProps) {
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCreditStats();
  }, []);

  const calculatePeriodStats = async (
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    isSpend: boolean
  ): Promise<PeriodStat> => {
    try {
      // Current period
      const { data: currentData } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Previous period
      const { data: previousData } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString());

      // Calculate totals based on spend or topup
      const currentAmount = currentData?.reduce((sum, t) => {
        if (isSpend) {
          return sum + Math.abs(t.amount < 0 ? t.amount : 0);
        } else {
          return sum + (t.amount > 0 ? t.amount : 0);
        }
      }, 0) || 0;

      const previousAmount = previousData?.reduce((sum, t) => {
        if (isSpend) {
          return sum + Math.abs(t.amount < 0 ? t.amount : 0);
        } else {
          return sum + (t.amount > 0 ? t.amount : 0);
        }
      }, 0) || 0;

      // Calculate percentage change
      let change = 0;
      let changeType: 'positive' | 'negative' | 'neutral' = 'neutral';

      if (previousAmount === 0 && currentAmount > 0) {
        change = 100;
        changeType = 'positive';
      } else if (previousAmount > 0) {
        change = ((currentAmount - previousAmount) / previousAmount) * 100;
        if (change > 0) {
          changeType = 'positive';
        } else if (change < 0) {
          changeType = 'negative';
        } else {
          changeType = 'neutral';
        }
      }

      return {
        amount: Math.round(currentAmount),
        change: Math.round(change),
        changeType
      };
    } catch (error) {
      console.error('Error calculating period stats:', error);
      return {
        amount: 0,
        change: 0,
        changeType: 'neutral'
      };
    }
  };

  const loadCreditStats = async () => {
    try {
      setLoading(true);
      const now = new Date();

      // Daily
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayEnd);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

      // Weekly (last 7 days)
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = now;
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(weekStart);

      // Monthly (last 30 days)
      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      const monthEnd = now;
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setDate(prevMonthStart.getDate() - 30);
      const prevMonthEnd = new Date(monthStart);

      // Quarterly (last 90 days)
      const quarterStart = new Date(now);
      quarterStart.setDate(quarterStart.getDate() - 90);
      const quarterEnd = now;
      const prevQuarterStart = new Date(quarterStart);
      prevQuarterStart.setDate(prevQuarterStart.getDate() - 90);
      const prevQuarterEnd = new Date(quarterStart);

      // Yearly (last 365 days)
      const yearStart = new Date(now);
      yearStart.setDate(yearStart.getDate() - 365);
      const yearEnd = now;
      const prevYearStart = new Date(yearStart);
      prevYearStart.setDate(prevYearStart.getDate() - 365);
      const prevYearEnd = new Date(yearStart);

      // Calculate all stats
      const [
        dailySpend, weeklySpend, monthlySpend, quarterlySpend, yearlySpend,
        dailyTopup, weeklyTopup, monthlyTopup, quarterlyTopup, yearlyTopup
      ] = await Promise.all([
        // Spend stats
        calculatePeriodStats(todayStart, todayEnd, yesterdayStart, yesterdayEnd, true),
        calculatePeriodStats(weekStart, weekEnd, prevWeekStart, prevWeekEnd, true),
        calculatePeriodStats(monthStart, monthEnd, prevMonthStart, prevMonthEnd, true),
        calculatePeriodStats(quarterStart, quarterEnd, prevQuarterStart, prevQuarterEnd, true),
        calculatePeriodStats(yearStart, yearEnd, prevYearStart, prevYearEnd, true),
        // Topup stats
        calculatePeriodStats(todayStart, todayEnd, yesterdayStart, yesterdayEnd, false),
        calculatePeriodStats(weekStart, weekEnd, prevWeekStart, prevWeekEnd, false),
        calculatePeriodStats(monthStart, monthEnd, prevMonthStart, prevMonthEnd, false),
        calculatePeriodStats(quarterStart, quarterEnd, prevQuarterStart, prevQuarterEnd, false),
        calculatePeriodStats(yearStart, yearEnd, prevYearStart, prevYearEnd, false)
      ]);

      setStats({
        spend: {
          daily: dailySpend,
          weekly: weeklySpend,
          monthly: monthlySpend,
          quarterly: quarterlySpend,
          yearly: yearlySpend
        },
        topup: {
          daily: dailyTopup,
          weekly: weeklyTopup,
          monthly: monthlyTopup,
          quarterly: quarterlyTopup,
          yearly: yearlyTopup
        }
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading credit stats:', error);
      setLoading(false);
    }
  };

  const getGradientClass = (changeType: string) => {
    if (changeType === 'positive') return 'credit-card-positive';
    if (changeType === 'negative') return 'credit-card-negative';
    return 'credit-card-neutral';
  };

  const getChangeIcon = (changeType: string) => {
    if (changeType === 'positive') return '▲';
    if (changeType === 'negative') return '▼';
    return '━';
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#a8a8a8' }}>Loading credit stats...</div>;
  }

  if (!stats) {
    return <div style={{ textAlign: 'center', color: '#a8a8a8' }}>No data available</div>;
  }

  return (
    <>
      <style jsx>{`
        .credit-section {
          background-color: #000000;
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 25px;
        }

        .credit-title {
          text-align: center;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 20px;
          letter-spacing: 1px;
          color: #ffffff;
        }

        .credit-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 15px;
        }

        .credit-card {
          border-radius: 12px;
          padding: 20px 15px;
          text-align: center;
        }

        .credit-card-positive {
          background: linear-gradient(to bottom, #1b3926, #1f1f22);
        }

        .credit-card-negative {
          background: linear-gradient(to bottom, #300d0d, #1f1f22);
        }

        .credit-card-neutral {
          background: linear-gradient(to bottom, #313236, #1f1f22);
        }

        .credit-period {
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
          color: #ffffff;
        }

        .credit-amount {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #ffffff;
        }

        .credit-compare {
          font-size: 10px;
          color: #a8a8a8;
          margin-bottom: 8px;
        }

        .credit-change {
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .credit-change.positive {
          color: #4ade80;
        }

        .credit-change.negative {
          color: #ef4444;
        }

        .credit-change.neutral {
          color: #a8a8a8;
        }

        @media (max-width: 1200px) {
          .credit-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .credit-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .credit-card {
            padding: 15px 10px;
          }

          .credit-amount {
            font-size: 22px;
          }

          .credit-change {
            font-size: 14px;
          }
        }
      `}</style>

      {/* Credit Spending Statistics */}
      <div className="credit-section">
        <h3 className="credit-title">CREDIT SPENDING STATISTICS</h3>
        <div className="credit-grid">
          <div className={`credit-card ${getGradientClass(stats.spend.daily.changeType)}`}>
            <div className="credit-period">DAILY SPEND</div>
            <div className="credit-amount">{stats.spend.daily.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.spend.daily.changeType}`}>
              {getChangeIcon(stats.spend.daily.changeType)} {Math.abs(stats.spend.daily.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.spend.weekly.changeType)}`}>
            <div className="credit-period">WEEKLY SPEND</div>
            <div className="credit-amount">{stats.spend.weekly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.spend.weekly.changeType}`}>
              {getChangeIcon(stats.spend.weekly.changeType)} {Math.abs(stats.spend.weekly.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.spend.monthly.changeType)}`}>
            <div className="credit-period">MONTHLY SPEND</div>
            <div className="credit-amount">{stats.spend.monthly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.spend.monthly.changeType}`}>
              {getChangeIcon(stats.spend.monthly.changeType)} {Math.abs(stats.spend.monthly.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.spend.quarterly.changeType)}`}>
            <div className="credit-period">3-MONTHLY SPEND</div>
            <div className="credit-amount">{stats.spend.quarterly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.spend.quarterly.changeType}`}>
              {getChangeIcon(stats.spend.quarterly.changeType)} {Math.abs(stats.spend.quarterly.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.spend.yearly.changeType)}`}>
            <div className="credit-period">YEARLY SPEND</div>
            <div className="credit-amount">{stats.spend.yearly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.spend.yearly.changeType}`}>
              {getChangeIcon(stats.spend.yearly.changeType)} {Math.abs(stats.spend.yearly.change)}%
            </div>
          </div>
        </div>
      </div>

      {/* Credit Top-Up Statistics */}
      <div className="credit-section">
        <h3 className="credit-title">CREDIT TOP-UP STATISTICS</h3>
        <div className="credit-grid">
          <div className={`credit-card ${getGradientClass(stats.topup.daily.changeType)}`}>
            <div className="credit-period">DAILY TOP-UP</div>
            <div className="credit-amount">{stats.topup.daily.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.topup.daily.changeType}`}>
              {getChangeIcon(stats.topup.daily.changeType)} {Math.abs(stats.topup.daily.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.topup.weekly.changeType)}`}>
            <div className="credit-period">WEEKLY TOP-UP</div>
            <div className="credit-amount">{stats.topup.weekly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.topup.weekly.changeType}`}>
              {getChangeIcon(stats.topup.weekly.changeType)} {Math.abs(stats.topup.weekly.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.topup.monthly.changeType)}`}>
            <div className="credit-period">MONTHLY TOP-UP</div>
            <div className="credit-amount">{stats.topup.monthly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.topup.monthly.changeType}`}>
              {getChangeIcon(stats.topup.monthly.changeType)} {Math.abs(stats.topup.monthly.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.topup.quarterly.changeType)}`}>
            <div className="credit-period">3-MONTHLY TOP-UP</div>
            <div className="credit-amount">{stats.topup.quarterly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.topup.quarterly.changeType}`}>
              {getChangeIcon(stats.topup.quarterly.changeType)} {Math.abs(stats.topup.quarterly.change)}%
            </div>
          </div>
          <div className={`credit-card ${getGradientClass(stats.topup.yearly.changeType)}`}>
            <div className="credit-period">YEARLY TOP-UP</div>
            <div className="credit-amount">{stats.topup.yearly.amount.toLocaleString('tr-TR')}</div>
            <div className="credit-compare">Compared To<br />The Previous One</div>
            <div className={`credit-change ${stats.topup.yearly.changeType}`}>
              {getChangeIcon(stats.topup.yearly.changeType)} {Math.abs(stats.topup.yearly.change)}%
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
