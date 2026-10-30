"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainMark } from "@/components/shared/brain-mark";
import { EmptyState } from "@/components/shared/empty-state";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { chartTooltip, orderTone } from "@/components/shared/tones";
import { useReady } from "@/components/shared/use-ready";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { ModuleUnavailable } from "@/components/shared/module-unavailable";
import { moduleEnabled } from "@/lib/business-types";
import { useBusiness } from "@/lib/business-context";

export default function CommercePage() {
  const { business, addTask } = useBusiness();
  const ready = useReady();
  const [query, setQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");

  const products = useMemo(
    () => business.products.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())),
    [business.products, query]
  );
  const orders = useMemo(
    () =>
      business.orders.filter((item) =>
        `${item.id} ${item.customer} ${item.items}`.toLowerCase().includes(orderQuery.trim().toLowerCase())
      ),
    [business.orders, orderQuery]
  );

  if (!moduleEnabled(business.type, "commerce")) return <ModuleUnavailable module="Commerce" type={business.type} />;

  return (
    <div className="space-y-4">
      <IllustrativeNote />
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card className="p-4 md:p-6">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" className="max-w-sm" />
            {!ready ? (
              <div className="mt-4">
                <ListSkeleton />
              </div>
            ) : products.length === 0 ? (
              <div className="mt-4">
                <EmptyState icon={Inbox} title="No products" description="Try another name from this workspace." />
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {products.map((product) => (
                  <article key={product.id} className="flex gap-3 rounded-inner border border-line p-3 transition-shadow hover:shadow-card">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-inner bg-accent-tint text-sm font-semibold text-accent">
                      {product.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-[12px] text-secondary">{product.category}</p>
                        </div>
                        <StatusChip tone={product.marginTone}>
                          {product.costMissing ? "Cost missing, profitability incomplete." : product.marginLabel}
                        </StatusChip>
                      </div>
                      <p className="mt-2 text-sm text-secondary">
                        {product.price} · Stock {product.stock} · Revenue {product.revenue}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-4 md:p-6">
            <Input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search orders" aria-label="Search orders" className="mb-4 max-w-sm" />
            {!ready ? (
              <ListSkeleton />
            ) : orders.length === 0 ? (
              <EmptyState icon={Inbox} title="No orders" description="Clear the search to see the sample orders." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Channel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>{order.items}</TableCell>
                      <TableCell>{order.total}</TableCell>
                      <TableCell>
                        <StatusChip tone={orderTone[order.status]}>{order.status}</StatusChip>
                      </TableCell>
                      <TableCell>{order.channel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {business.lowStock.map((item) => (
              <Card key={item.name} className="p-4">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-secondary">{item.left}</p>
                <div className="mt-3">
                  {item.reorder ? <StatusChip tone="lavender">Reorder suggested</StatusChip> : <StatusChip tone="sand">Watch</StatusChip>}
                </div>
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <SectionHeader title="Stock versus 14-day pace" description="Forecast is illustrative." />
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={business.stock}>
                  <CartesianGrid stroke="#E7EBF5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Bar dataKey="stock" fill="#3D6EE0" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="forecast" fill="#C9D6F7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid gap-3">
            {business.commerceInsights.map((insight) => (
              <Card key={insight.id} className="p-5">
                <BrainMark />
                <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.02em]">{insight.title}</h3>
                <p className="mt-2 text-sm text-secondary">{insight.detail}</p>
                <p className="mt-2 text-sm">{insight.action}</p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    addTask(insight.action);
                    toast({ title: "Task created", description: "It is on the Operations list." });
                  }}
                >
                  Create task
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card className="p-4 md:p-6">
            {business.suppliers.length === 0 ? (
              <EmptyState icon={Inbox} title="No suppliers" description="Add a supplier when you connect purchasing." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Lead time</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {business.suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.category}</TableCell>
                      <TableCell>{supplier.city}</TableCell>
                      <TableCell>{supplier.leadTime}</TableCell>
                      <TableCell>{supplier.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="returns">
          <Card className="p-4 md:p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {business.returns.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.id}</TableCell>
                    <TableCell>{item.orderId}</TableCell>
                    <TableCell>{item.customer}</TableCell>
                    <TableCell>{item.item}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell>
                      <StatusChip tone="sand">{item.status}</StatusChip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
