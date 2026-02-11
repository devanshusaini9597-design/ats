import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import { BarChart3, Users, Briefcase, Clock, TrendingUp, ArrowRight } from 'lucide-react';

const DashboardPage = () => {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    totalCandidates: 0,
    openJobs: 0,
    pendingReview: 0,
    thisMonth: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard stats and activity from backend
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        // Fetch candidates data
        const candidatesResponse = await fetch('http://localhost:5000/api/candidates', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!candidatesResponse.ok) throw new Error('Failed to fetch candidates');
        const candidatesData = await candidatesResponse.json();
        
        // Calculate stats from the data
        const candidates = candidatesData.data || [];
        const totalCandidates = candidatesData.total || candidates.length;
        const pendingReview = candidates.filter(c => c.status === 'pending' || c.status === 'Pending').length;
        const thisMonth = candidates.filter(c => {
          const candidateDate = new Date(c.date);
          const now = new Date();
          return candidateDate.getMonth() === now.getMonth() && candidateDate.getFullYear() === now.getFullYear();
        }).length;
        
        setStats({
          totalCandidates: totalCandidates,
          openJobs: 12, // Placeholder - can be updated with actual job endpoint
          pendingReview: pendingReview,
          thisMonth: thisMonth
        });

        // Generate recent activity from candidates data
        const activities = [];
        const sortedCandidates = [...candidates].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Add recent candidates
        sortedCandidates.slice(0, 3).forEach(candidate => {
          const date = new Date(candidate.date);
          const now = new Date();
          const diff = now - date;
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          
          let timeStr = '';
          if (hours < 1) timeStr = 'moments ago';
          else if (hours < 24) timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
          else if (days < 7) timeStr = `${days} day${days > 1 ? 's' : ''} ago`;
          else timeStr = date.toLocaleDateString();
          
          activities.push({
            title: `New candidate added: ${candidate.name || 'Unnamed'}`,
            status: candidate.status || 'applied',
            time: timeStr,
            type: 'candidate'
          });
        });

        // Add pending review count if > 0
        if (pendingReview > 0) {
          activities.push({
            title: `${pendingReview} candidate${pendingReview > 1 ? 's' : ''} awaiting review`,
            status: 'pending',
            time: 'in review queue',
            type: 'review'
          });
        }

        // Add this month summary
        if (thisMonth > 0) {
          activities.push({
            title: `${thisMonth} candidate${thisMonth > 1 ? 's' : ''} added this month`,
            status: 'completed',
            time: 'current month',
            type: 'summary'
          });
        }

        setRecentActivity(activities.slice(0, 5));
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Fallback to mock data on error
        setStats({
          totalCandidates: 248,
          openJobs: 12,
          pendingReview: 23,
          thisMonth: 45
        });
        setRecentActivity([
          { title: '48 candidates imported from Excel', status: 'completed', time: '2 hours ago', type: 'import' },
          { title: '23 candidates awaiting review', status: 'pending', time: '5 hours ago', type: 'review' },
          { title: 'New candidates added this month', status: 'completed', time: 'current month', type: 'summary' }
        ]);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const StatCard = ({ icon: Icon, label, value, trend, color }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={16} className={trend > 0 ? 'text-green-600' : 'text-red-600'} />
              <span className={trend > 0 ? 'text-green-600' : 'text-red-600'} style={{fontSize: '0.875rem'}}>
                {trend > 0 ? '+' : ''}{trend}% this month
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  const ActivityItem = ({ title, status, time }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div>
        <p className="text-gray-900 font-medium text-sm">{title}</p>
        <p className="text-gray-500 text-xs mt-1">{time}</p>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
        status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
        status === 'completed' ? 'bg-green-100 text-green-800' :
        'bg-blue-100 text-blue-800'
      }`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your recruitment overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            label="Total Candidates"
            value={stats.totalCandidates}
            trend={12}
            color="bg-blue-600"
          />
          <StatCard
            icon={Briefcase}
            label="Active Jobs"
            value={stats.openJobs}
            trend={8}
            color="bg-green-600"
          />
          <StatCard
            icon={Clock}
            label="Pending Review"
            value={stats.pendingReview}
            trend={-5}
            color="bg-orange-600"
          />
          <StatCard
            icon={BarChart3}
            label="This Month"
            value={`+${stats.thisMonth}`}
            trend={23}
            color="bg-purple-600"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
              <button 
                onClick={() => navigate('/ats')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
            <div>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <ActivityItem 
                    key={index}
                    title={activity.title} 
                    status={activity.status} 
                    time={activity.time}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-sm py-4">No recent activity</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/add-candidate')}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Add Candidate
              </button>
              <button 
                onClick={() => navigate('/ats')}
                className="w-full px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg font-medium transition-colors"
              >
                View All Candidates
              </button>
              <button 
                onClick={() => alert('🚀 Feature Coming Soon')}
                className="w-full px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg font-medium transition-colors"
              >
                Send Bulk Email
              </button>
              <button 
                onClick={() => alert('🚀 Feature Coming Soon')}
                className="w-full px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-lg font-medium transition-colors"
              >
                View Reports
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Hiring Pipeline</h2>
            <div className="space-y-4">
              {[
                { stage: 'Applied', count: 248, percentage: 100 },
                { stage: 'Screening', count: 156, percentage: 63 },
                { stage: 'Interview', count: 48, percentage: 19 },
                { stage: 'Offer', count: 12, percentage: 5 },
                { stage: 'Hired', count: 8, percentage: 3 }
              ].map((item) => (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{item.stage}</span>
                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Top Job Positions</h2>
            <div className="space-y-4">
              {[
                { position: 'Software Engineer', count: 45 },
                { position: 'Product Manager', count: 28 },
                { position: 'UI/UX Designer', count: 22 },
                { position: 'Data Analyst', count: 18 },
                { position: 'HR Manager', count: 12 }
              ].map((item) => (
                <div key={item.position} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.position}</p>
                  </div>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
