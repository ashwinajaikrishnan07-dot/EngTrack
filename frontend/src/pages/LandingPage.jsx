import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, GitBranch, ShieldAlert, Kanban, Bell, BarChart2, 
  CheckCircle, ArrowRight
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen font-['Inter',sans-serif] text-gray-900 bg-white">
      
      {/* ===== HERO & NAVBAR SECTION ===== */}
      <div className="bg-[#2952e3]">
        {/* Navbar */}
        <nav className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Logo Image Placeholder - User needs to place logo.png in public folder */}
            <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
              <img 
                src="/logo.png" 
                alt="Gitora" 
                className="h-8 w-auto object-contain bg-white/20 rounded p-1" 
                onError={(e) => {
                  e.target.style.display='none';
                  e.target.nextElementSibling.style.display='block';
                }}
              />
              <span className="hidden">Gitora</span> {/* Fallback text if image fails */}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/90">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#docs" className="hover:text-white transition-colors">Docs</a>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-white/90 hover:text-white hidden sm:block">Sign in</Link>
            <Link 
              to="/register/lead" 
              className="bg-white text-[#2952e3] text-sm font-semibold px-5 py-2 rounded-full hover:bg-gray-50 transition-colors shadow-sm"
            >
              Get started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="container mx-auto px-6 pt-16 pb-32 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left text-white">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-8">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              Now with AI auto-triage
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Your issues, <br />
              <span className="text-[#a8c4ff]">finally triaged</span>
            </h1>
            
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto lg:mx-0 font-normal">
              Connect your repositories, automatically assign issues based on expertise, and keep your team notified in real-time.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link 
                to="/register/lead" 
                className="w-full sm:w-auto bg-white text-[#2952e3] hover:bg-gray-50 text-base font-semibold px-8 py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10"
              >
                Connect GitHub <ArrowRight className="w-4 h-4" />
              </Link>
              <a 
                href="#how-it-works" 
                className="w-full sm:w-auto text-white border border-white/30 hover:bg-white/10 text-base font-semibold px-8 py-3.5 rounded-full transition-colors flex items-center justify-center"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* App Preview Card */}
          <div className="flex-1 w-full max-w-2xl lg:-mr-12">
            <div className="bg-white rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-gray-100">
              {/* Metric Tiles */}
              <div className="grid grid-cols-3 border-b border-gray-100 p-4 gap-4 bg-gray-50/50">
                <div className="bg-[#eef2ff] p-3 rounded-lg border border-[#c7d2fe]">
                  <p className="text-[#4338ca] text-xs font-semibold mb-1">Open Issues</p>
                  <p className="text-[#3730a3] text-2xl font-bold">24</p>
                </div>
                <div className="bg-[#edfbf1] p-3 rounded-lg border border-[#bbf7d0]">
                  <p className="text-[#15803d] text-xs font-semibold mb-1">In Progress</p>
                  <p className="text-[#166534] text-2xl font-bold">8</p>
                </div>
                <div className="bg-[#f8f9fa] p-3 rounded-lg border border-gray-200">
                  <p className="text-gray-600 text-xs font-semibold mb-1">Closed</p>
                  <p className="text-gray-800 text-2xl font-bold">142</p>
                </div>
              </div>
              
              {/* Issue Rows */}
              <div className="divide-y divide-gray-100">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold shrink-0">AS</div>
                    <div className="min-w-0">
                      <h4 className="text-gray-900 font-semibold text-sm truncate">Memory leak in user dashboard #142</h4>
                      <p className="text-gray-500 text-xs truncate">frontend/src/views · Assigned to Alex</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-full shrink-0 w-max">Bug</div>
                </div>
                
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-semibold shrink-0">JD</div>
                    <div className="min-w-0">
                      <h4 className="text-gray-900 font-semibold text-sm truncate">Implement OAuth 2.0 Login #143</h4>
                      <p className="text-gray-500 text-xs truncate">backend/auth · Assigned to John</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full shrink-0 w-max">Feature</div>
                </div>

                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-semibold shrink-0">MK</div>
                    <div className="min-w-0">
                      <h4 className="text-gray-900 font-semibold text-sm truncate">Refactor webhook payload parsing #145</h4>
                      <p className="text-gray-500 text-xs truncate">backend/api · PR open</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-green-100 text-green-700 border border-green-200 text-xs font-semibold rounded-full shrink-0 w-max">PR Ready</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURES SECTION ===== */}
      <section id="features" className="bg-white py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything you need to ship faster</h2>
            <p className="text-lg text-gray-500">Stop manually assigning tickets. Let Gitora handle the busywork so your engineers can focus on code.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-[#2952e3] rounded-xl flex items-center justify-center mb-6">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Auto-Triage</h3>
              <p className="text-gray-500 leading-relaxed">Automatically categorize bugs, features, and chores based on issue descriptions and code context.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-[#2952e3] rounded-xl flex items-center justify-center mb-6">
                <GitBranch className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Smart Routing</h3>
              <p className="text-gray-500 leading-relaxed">Route issues directly to the engineers who own the affected codebase or have the most context.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-[#2952e3] rounded-xl flex items-center justify-center mb-6">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Duplicate Detection</h3>
              <p className="text-gray-500 leading-relaxed">Instantly spot duplicate issue reports and merge them to keep your backlog clean and actionable.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-[#2952e3] rounded-xl flex items-center justify-center mb-6">
                <Kanban className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Sprint View</h3>
              <p className="text-gray-500 leading-relaxed">Organize triaged issues into visual kanban boards and manage your team's weekly sprint cycles.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-[#2952e3] rounded-xl flex items-center justify-center mb-6">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Team Alerts</h3>
              <p className="text-gray-500 leading-relaxed">Send intelligent notifications to Slack or email when priority bugs drop or PRs need review.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-[#2952e3] rounded-xl flex items-center justify-center mb-6">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Repo Insights</h3>
              <p className="text-gray-500 leading-relaxed">Track resolution times, identify bottlenecks, and measure team velocity with deep analytics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS SECTION ===== */}
      <section id="how-it-works" className="bg-[#2952e3] py-24 text-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-lg text-[#a8c4ff]">Get up and running in less than 3 minutes.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-white/20 z-0"></div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white text-[#2952e3] text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-black/10">1</div>
              <h3 className="text-xl font-bold mb-3">Connect your repo</h3>
              <p className="text-white/80">Install the Gitora GitHub app and select the repositories you want to track.</p>
            </div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white text-[#2952e3] text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-black/10">2</div>
              <h3 className="text-xl font-bold mb-3">Issues get triaged</h3>
              <p className="text-white/80">Our AI instantly analyzes incoming issues, categorizes them, and finds the right assignee.</p>
            </div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white text-[#2952e3] text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-black/10">3</div>
              <h3 className="text-xl font-bold mb-3">Team gets notified</h3>
              <p className="text-white/80">The right engineer is alerted with full context, ready to review or merge.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section id="pricing" className="bg-white py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-500">Start for free, upgrade when your team grows.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            {/* Free */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Free</h3>
              <p className="text-gray-500 mb-6 h-12">Perfect for side projects and indie hackers.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <Link to="/register/lead" className="block w-full text-center bg-white border-2 border-gray-200 text-gray-800 hover:border-[#2952e3] hover:text-[#2952e3] font-semibold py-3 rounded-full transition-colors mb-8">
                Get Started
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Up to 3 repos</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> 5 team members</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Manual triage</li>
              </ul>
            </div>

            {/* Pro */}
            <div className="bg-white border-2 border-[#2952e3] rounded-2xl p-8 shadow-xl relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#2952e3] text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pro</h3>
              <p className="text-gray-500 mb-6 h-12">For growing teams that need automation.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$29</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <Link to="/register/lead" className="block w-full text-center bg-[#2952e3] text-white hover:bg-blue-700 font-semibold py-3 rounded-full transition-colors mb-8 shadow-md">
                Start 14-day trial
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-[#2952e3] shrink-0" /> Unlimited repos</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-[#2952e3] shrink-0" /> 15 team members</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-[#2952e3] shrink-0" /> AI Auto-triage</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-[#2952e3] shrink-0" /> Slack alerts</li>
              </ul>
            </div>

            {/* Team */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Team</h3>
              <p className="text-gray-500 mb-6 h-12">For large engineering organizations.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$99</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <Link to="/register/lead" className="block w-full text-center bg-white border-2 border-gray-200 text-gray-800 hover:border-[#2952e3] hover:text-[#2952e3] font-semibold py-3 rounded-full transition-colors mb-8">
                Contact Sales
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Unlimited repos & members</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Advanced repo insights</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Custom workflow routing</li>
                <li className="flex items-center gap-3 text-gray-600"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Priority support</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0f172a] text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-800 pb-8 mb-8 gap-6">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Gitora" 
                className="h-8 w-auto object-contain bg-white/20 rounded p-1"
                onError={(e) => {
                  e.target.style.display='none';
                }}
              />
              <span className="text-xl font-bold tracking-tight">Gitora</span>
            </div>
            
            <div className="flex gap-8 text-sm font-medium text-gray-400">
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Gitora Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                  <path d="M9 18c-4.51 2-5-2-7-2"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
