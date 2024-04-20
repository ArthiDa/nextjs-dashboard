import { sql } from '@vercel/postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';

import conn from './db';

export async function fetchRevenue() {
  // Add noStore() here to prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();
  const client = await conn.connect();

  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // const data = await sql<Revenue>`SELECT * FROM revenue`;
    const data = await client.query('SELECT * FROM revenue');

    const revenue = data.rows as Revenue[];

    console.log('Data fetch completed');
    return revenue;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  } finally {
    client.release();
  }
}

export async function fetchLatestInvoices() {
  noStore();
  const client = await conn.connect();
  try {
    // const data = await sql<LatestInvoiceRaw>`
    //   SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   ORDER BY invoices.date DESC
    //   LIMIT 5`;

    const data = await client.query(
      'SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id FROM invoices JOIN customers ON invoices.customer_id = customers.id ORDER BY invoices.date DESC LIMIT 5',
    );

    const latestInvoices = data.rows.map((invoice: LatestInvoiceRaw) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices as LatestInvoiceRaw[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  } finally {
    client.release();
  }
}

export async function fetchCardData() {
  noStore();
  const client = await conn.connect();
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    // const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    // const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    // const invoiceStatusPromise = sql`SELECT
    //      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
    //      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
    //      FROM invoices`;
    const invoiceCountQuery = 'SELECT COUNT(*) FROM invoices';
    const customerCountQuery = 'SELECT COUNT(*) FROM customers';
    const invoiceStatusQuery = `
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
      FROM invoices
    `;
    const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
      client.query(invoiceCountQuery),
      client.query(customerCountQuery),
      client.query(invoiceStatusQuery),
    ]);

    const numberOfInvoices = Number(invoiceCount.rows[0].count ?? '0');
    const numberOfCustomers = Number(customerCount.rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(invoiceStatus.rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(
      invoiceStatus.rows[0].pending ?? '0',
    );

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  } finally {
    client.release();
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  noStore();

  const client = await conn.connect();

  try {
    // const/

    const data = await client.query(
      `SELECT invoices.id, invoices.amount, invoices.date, invoices.status, customers.name, customers.email, customers.image_url FROM invoices JOIN customers ON invoices.customer_id = customers.id WHERE customers.name ILIKE '%${query}%' OR customers.email ILIKE '%${query}%' OR invoices.amount::text ILIKE '%${query}%' OR invoices.date::text ILIKE '%${query}%' OR invoices.status ILIKE '%${query}%' ORDER BY invoices.date DESC LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`,
    );

    const invoices = data.rows as InvoicesTable[];

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  } finally {
    client.release();
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();

  const client = await conn.connect();

  try {
    //   const count = await sql`SELECT COUNT(*)
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   WHERE
    //     customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`} OR
    //     invoices.amount::text ILIKE ${`%${query}%`} OR
    //     invoices.date::text ILIKE ${`%${query}%`} OR
    //     invoices.status ILIKE ${`%${query}%`}
    // `;

    const count = await client.query(
      `SELECT COUNT(*) FROM invoices JOIN customers ON invoices.customer_id = customers.id WHERE customers.name ILIKE '%${query}%' OR customers.email ILIKE '%${query}%' OR invoices.amount::text ILIKE '%${query}%' OR invoices.date::text ILIKE '%${query}%' OR invoices.status ILIKE '%${query}%'`,
    );

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  } finally {
    client.release();
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();

  const client = await conn.connect();

  try {
    // const data = await sql<InvoiceForm>`
    //   SELECT
    //     invoices.id,
    //     invoices.customer_id,
    //     invoices.amount,
    //     invoices.status
    //   FROM invoices
    //   WHERE invoices.id = ${id};
    // `;
    const data = await client.query(
      `SELECT invoices.id, invoices.customer_id, invoices.amount, invoices.status FROM invoices WHERE invoices.id = '${id}'`,
    );

    const invoice = data.rows.map((invoice: InvoiceForm) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  } finally {
    client.release();
  }
}

export async function fetchCustomers() {
  noStore();

  const client = await conn.connect();

  try {
    // const data = await sql<CustomerField>`
    //   SELECT
    //     id,
    //     name
    //   FROM customers
    //   ORDER BY name ASC
    // `;

    const data = await client.query(
      'SELECT id, name FROM customers ORDER BY name ASC',
    );

    const customers = data.rows as CustomerField[];
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  } finally {
    client.release();
  }
}

export async function fetchFilteredCustomers(query: string) {
  noStore();

  const client = await conn.connect();

  try {
    // const data = await sql<CustomersTableType>`
    // SELECT
    //   customers.id,
    //   customers.name,
    //   customers.email,
    //   customers.image_url,
    //   COUNT(invoices.id) AS total_invoices,
    //   SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
    //   SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
    // FROM customers
    // LEFT JOIN invoices ON customers.id = invoices.customer_id
    // WHERE
    //   customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`}
    // GROUP BY customers.id, customers.name, customers.email, customers.image_url
    // ORDER BY customers.name ASC
    // `;

    const data = await client.query(
      `SELECT customers.id, customers.name, customers.email, customers.image_url, COUNT(invoices.id) AS total_invoices, SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending, SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid FROM customers LEFT JOIN invoices ON customers.id = invoices.customer_id WHERE customers.name ILIKE '%${query}%' OR customers.email ILIKE '%${query}%' GROUP BY customers.id, customers.name, customers.email, customers.image_url ORDER BY customers.name ASC`,
    );

    const customers = data.rows.map((customer: CustomersTableType) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  } finally {
    client.release();
  }
}

export async function getUser(email: string) {
  noStore();
  const client = await conn.connect();

  try {
    // const user = await sql`SELECT * FROM users WHERE email=${email}`;
    const user = await client.query(
      `SELECT * FROM users WHERE email='${email}'`,
    );
    return user.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
