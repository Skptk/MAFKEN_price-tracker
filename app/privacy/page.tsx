import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#f3f4f6] p-4 sm:p-8 font-sans">
            <div className="max-w-4xl mx-auto bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 sm:p-12">
                    <Link href="/" className="inline-flex items-center gap-2 text-green-700 font-medium mb-8 hover:underline">
                        <ArrowLeft size={20} />
                        Back to Dashboard
                    </Link>

                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                    <p className="text-gray-500 mb-8">Last updated: November 25, 2025</p>

                    <div className="space-y-8 text-gray-700 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
                            <p>
                                aggregateDuka ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                                when you visit our website and use our price tracking services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
                            <p className="mb-2">We may collect information about you in a variety of ways. The information we may collect includes:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Personal Data:</strong> Personally identifiable information, such as your name and email address, that you voluntarily give to us when you register or choose to participate in various activities related to the service.</li>
                                <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Site, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Site.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Use of Your Information</h2>
                            <p className="mb-2">Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Create and manage your account.</li>
                                <li>Send you email notifications regarding price alerts.</li>
                                <li>Compile anonymous statistical data and analysis for use internally.</li>
                                <li>Monitor and analyze usage and trends to improve your experience with the Site.</li>
                                <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Data Retention</h2>
                            <p>
                                We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our legal agreements and policies.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Security</h2>
                            <p>
                                We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your Data Protection Rights</h2>
                            <p className="mb-2">We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>The right to access – You have the right to request copies of your personal data.</li>
                                <li>The right to rectification – You have the right to request that we correct any information you believe is inaccurate.</li>
                                <li>The right to erasure – You have the right to request that we erase your personal data, under certain conditions.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Contact Us</h2>
                            <p>
                                If you have any questions about this Privacy Policy, please contact me at vibecodekijana@gmail.com.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
