import React from "react";
import { Card, CardBody, CardHeader } from "../ui/Card";

export default function OverviewPage() {
    return (
        <div className="space-y-4">
            <div>
                <div className="text-lg font-semibold">Overview</div>
                <div className="mt-1 text-sm text-neutral-500">
                    Your workspace at a glance. (v1: Compute + Buckets)
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader title="Compute" subtitle="Manage container-based compute instances." />
                    <CardBody>
                        <div className="text-sm text-neutral-600">Go to Compute to create and manage workloads.</div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Buckets" subtitle="S3-like object storage powered by MinIO." />
                    <CardBody>
                        <div className="text-sm text-neutral-600">Browse objects, upload, download, and delete.</div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
