import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AppPreloadService {
  private dashboardPreloaded = false;

  public preloadDashboardAssets(): void {
    if (this.dashboardPreloaded) {
      return;
    }

    this.dashboardPreloaded = true;

    void import('../../features/dashboard/pages/dashboard/dashboard.page');
    void import('apexcharts');
    void import('ng-apexcharts');
  }
}
