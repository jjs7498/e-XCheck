import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
interface TableData {
  date: string;
  number_of_checkouts: string;
  total: number;
}

export interface Result {
  totalPrice: number;
  transactions: Transaction[];
}

export interface Transaction {
  createdAt: Date;
  products: Product[];
  totalPrice: number;
}

export interface Product {
  itemName: string;
  quantity: number;
  price: number | string;
}

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit {
  isVisible = false; // Modal visibility
  selectedData: any; // Data for the selected date

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  public barChartLegend = true;
  public barChartPlugins = [];
  salesData: any[] = [];
  selectedSalesData: Transaction[] = [];

  tableData: TableData[] = [
    // { date: '4/4/23', number_of_checkouts: 12, total: 48.21 },
    // { date: '4/3/23', number_of_checkouts: 23, total: 77.77 },
    // { date: '4/2/23', number_of_checkouts: 38, total: 152.92 },
    // { date: '4/1/23', number_of_checkouts: 41, total: 163.86 },
    // { date: '3/31/23', number_of_checkouts: 25, total: 81.9 },
    // { date: '3/30/23', number_of_checkouts: 20, total: 74.6 },
    // { date: '3/29/23', number_of_checkouts: 31, total: 121.75 },
    // { date: '3/28/23', number_of_checkouts: 28, total: 102 },
    // { date: '3/27/23', number_of_checkouts: 17, total: 64.5 },
    // { date: '3/26/23', number_of_checkouts: 11, total: 25 },
    // { date: '3/25/23', number_of_checkouts: 9, total: 31.2 },
  ];

  rprelabel: string[] = [];
  rpretotal: number[] = [];
  rpretaxes: number[] = [];
  rprenet: number[] = [];

  public barChartTotalData: ChartConfiguration<'bar'>['data'] = {
    labels: this.rprelabel,
    datasets: [
      {
        data: this.rpretotal,
        backgroundColor: 'limegreen',
        label: 'Total Sales',
      },
    ],
  };

  public barChartTaxesData: ChartConfiguration<'bar'>['data'] = {
    labels: this.rprelabel,
    datasets: [
      { data: this.rpretaxes, backgroundColor: 'limegreen', label: 'Taxes' },
    ],
  };

  public barChartNetData: ChartConfiguration<'bar'>['data'] = {
    labels: this.rprelabel,
    datasets: [
      { data: this.rprenet, backgroundColor: 'limegreen', label: 'Net Sales' },
    ],
  };

  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
  };

  ngOnInit(): void {
    this.fetchTableData();
  }

  fetchTableData() {
    this.http
      .get(environment.api_host + '/transactions')
      .subscribe((data: any) => {
        const prepData = [];
        const result = data.result;
        this.salesData = result;

        // Loop through each date (date is the key) and add the number of checkouts and total sales
        // to the prepData array
        for (const date in result) {
          prepData.push({
            date,
            number_of_checkouts: result[date].transactions.length,
            total: result[date].totalPrice,
          });
        }

        // Sort the prepData array by date
        prepData.sort((a, b) => {
          const aDate = new Date(a.date);
          const bDate = new Date(b.date);

          return aDate.getTime() - bDate.getTime();
        });

        // Set the tableData to the prepData array
        this.tableData = prepData;
        this.reloadTableData();
      });
  }

  reloadTableData() {
    const past_10 = this.tableData.slice(0, 10);
    const prelabel = past_10.map((data) => data.date);
    const pretotal = past_10.map((data) =>
      parseFloat((data.total * 1.06).toFixed(2))
    );
    const prenet = past_10.map((data) => data.total);
    const pretaxes = past_10.map((data) =>
      parseFloat((data.total * 1.06 - data.total).toFixed(2))
    );
    this.rprelabel = prelabel;
    this.rpretotal = pretotal;
    this.rpretaxes = pretaxes;
    this.rprenet = prenet;
    this.barChartTotalData = {
      labels: this.rprelabel,
      datasets: [
        {
          data: this.rpretotal,
          backgroundColor: 'limegreen',
          label: 'Total Sales',
        },
      ],
    };
    this.barChartTaxesData = {
      labels: this.rprelabel,
      datasets: [
        { data: this.rpretaxes, backgroundColor: 'limegreen', label: 'Taxes' },
      ],
    };
    this.barChartNetData = {
      labels: this.rprelabel,
      datasets: [
        {
          data: this.rprenet,
          backgroundColor: 'limegreen',
          label: 'Net Sales',
        },
      ],
    };
  }

  getTotalCheckouts() {
    return this.tableData.reduce(
      (acc, curr) => parseFloat(acc + curr.number_of_checkouts),
      0
    );
  }

  getTotalSales() {
    return this.tableData.reduce((acc, curr) => acc + curr.total, 0);
  }

  getTaxes() {
    return this.getTotalSales() * 0.06;
  }

  getNetGain() {
    return this.getTotalSales() - this.getTaxes();
  }

  // Show modal and set selected data
  showModal(date: string): void {
    this.isVisible = true;
    this.selectedData = this.tableData.find((data) => data.date === date);
    // @ts-ignore
    this.selectedSalesData = this.salesData[date].transactions;
    this.changeDetectorRef.detectChanges(); // Manually trigger change detection
  }

  // Handle modal cancel
  handleCancel(): void {
    this.isVisible = false;
  }

  // Handle modal OK
  handleOk(): void {
    this.isVisible = false;
  }
}
