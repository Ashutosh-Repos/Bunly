"use client";

import { Button } from '@/components/ui/button'
import { IconVideoPlus } from '@tabler/icons-react'
import { useUpload } from "@/components/providers/upload-provider";


const UploadBtn = () => {
    const { openModal } = useUpload();
  return (
    <Button onClick={() => openModal()} variant="outline" className="gap-2 bg-background">
        <IconVideoPlus className="h-4 w-4" />
        <span>Create</span>
    </Button>
  )
}

export default UploadBtn