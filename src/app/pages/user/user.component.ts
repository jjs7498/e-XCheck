import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NzModalService, NzModalRef } from 'ng-zorro-antd/modal';
import { environment } from 'src/environments/environment';

interface TableData {
  image: string;
  itemName: string;
  quantity: number;
  price: number;
}

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class UserComponent implements OnInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef;
  
  tableData: TableData[] = [];
  confirmModal?: NzModalRef; // For testing by now

  public isAutoScan = false;
  public isScanning = false; 

  scanInterval: any;

  constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'environment',
    },
  };
  
  constructor(
    private http: HttpClient,
    private modal: NzModalService
  ) {}

  ngOnInit(): void {
    this.startVideo();
  }

  async startVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(this.constraints);
      this.videoElement.nativeElement.srcObject = stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  }

  getTotal(): number {
    // Calculate the sum of the price of all items
    const sum = this.tableData.reduce((acc, item) => acc + item.price * item.quantity, 0);
    return sum;
  }
  
  getTaxes(): number {
    // Calculate the taxes, e.g., 6% of the total
    const taxes = this.getTotal() * 0.06;
    return taxes;
  }

  takepicture() {
    const context = this.canvasElement.nativeElement.getContext("2d");
    this.canvasElement.nativeElement.width = this.constraints.video.width.ideal;
    this.canvasElement.nativeElement.height = this.constraints.video.height.ideal;
      context.drawImage(this.videoElement.nativeElement, 0, 0,
         this.constraints.video.width.ideal,
          this.constraints.video.height.ideal);
    const data = this.canvasElement.nativeElement.toDataURL("image/png");
      return data;
  }

  scan() {
    this.isScanning = true;
    const base64Data = this.takepicture();
    this.http.post(environment.api_host + '/predict-image', {
      image: base64Data,
      confidence: 0.5,
    })
    .subscribe((res: any) => {
      this.isScanning = false;
      console.log(res);
      const newTableData: TableData[] = [];
      res.result.forEach((item: any, index:number) => {
         // TODO: increment quantity if item already exists
         newTableData.push({
          image: item.image,
          itemName: item.tagName,
          quantity: 1,
          price: item.productInfo === null ? 0 : item.productInfo.price.toFixed(2),
        });
      });
      this.tableData = newTableData;
    });
  }

  checkout() {

    if(this.tableData.length === 0) {
      return;
    }

    this.confirmModal = this.modal.confirm({
      nzTitle: 'Do you Want to checkout?',
      nzContent: 'Make sure you have scanned all items',
      nzOnOk: () =>
        new Promise((resolve, reject)=> {
          // setTimeout(Math.random() > 0.5 ? resolve : reject, 1000);
          // removed items's image from the payload
          const formatted = this.tableData.map((item) => {
            return {
              itemName: item.itemName,
              quantity: item.quantity,
              price: item.price,
            }
          });
          this.http.post(environment.api_host + '/checkout', {
            products: formatted,
          })
          .subscribe((res: any) => {
            console.log(res);
            this.tableData = [];
            // @ts-ignore
            resolve();
          }, (err) => {
            console.log(err);
            reject();
          });
        }).catch(() => {
          console.log('Oops errors!');
        })
    });
  }

  toggleAutoScan() {
    if(!this.isAutoScan) {
      this.scanInterval = setInterval(() => {
        this.scan();
      }, 5000);
      this.scan(); // scan once
      this.isAutoScan = true;
      this.videoElement.nativeElement.classList.add('active-scan');
      return;
    }else{
      clearInterval(this.scanInterval);
      this.videoElement.nativeElement.classList.remove('active-scan');
      this.isAutoScan = false;
    }
  }

}