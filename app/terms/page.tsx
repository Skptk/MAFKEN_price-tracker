'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#f3f4f6] p-4 sm:p-8 font-sans">
            <div className="max-w-4xl mx-auto bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 sm:p-12">
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-green-700 font-medium mb-8 hover:underline">
                        <ArrowLeft size={20} />
                        Back to Dashboard
                    </Link>

                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
                    <p className="text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>

                    <div className="space-y-8 text-gray-700 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
                            <p>
                                Welcome to arbitrageDuka. By accessing or using our website and services, you agree to be bound by these Terms and Conditions.
                                If you disagree with any part of these terms, you may not access the service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Use of Service</h2>
                            <p>
                                arbitrageDuka provides a price tracking service for products listed on Carrefour Kenya. You agree to use this service only for lawful purposes
                                and in accordance with these Terms. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Accuracy of Information</h2>
                            <p>
                                While we strive to provide accurate and up-to-date price information, we cannot guarantee the real-time accuracy of prices displayed on arbitrageDuka.
                                Prices on the retailer's website may change without notice and may differ from those shown on our platform. We are not responsible for any discrepancies.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Intellectual Property</h2>
                            <p>
                                The content, features, and functionality of arbitrageDuka are and will remain the exclusive property of arbitrageDuka and its licensors.
                                Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of arbitrageDuka.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Limitation of Liability</h2>
                            <p>
                                In no event shall arbitrageDuka, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental,
                                special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses,
                                resulting from your access to or use of or inability to access or use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Governing Law</h2>
                            <p>
                                These Terms shall be governed and construed in accordance with the laws of Kenya, without regard to its conflict of law provisions.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Changes</h2>
                            <p>
                                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide
                                at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact Us</h2>
                            <p>
                                If you have any questions about these Terms, please contact me at vibecodekijana@gmail.com.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
